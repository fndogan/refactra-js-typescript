import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import pLimit from 'p-limit';

import { loadConfig, requireSource } from '../config.js';
import { convertWithAI, isTruncated } from '../core/ai.js';
import { aliasesToTsConfigPaths, resolvePathAliases } from '../core/aliases.js';
import { analyzeFileAST } from '../core/ast.js';
import { applyCodemods } from '../core/codemods.js';
import { runMechanicalMigration } from '../core/copy.js';
import {
    buildDependencyGraph,
    detectBrokenImports,
    getFileContext,
    saveDepsReport,
} from '../core/dependencies.js';
import { formatContent } from '../core/format.js';
import { runMetrics } from '../core/metrics.js';
import { analyzeReactFile, formatReactContextForAI } from '../core/react.js';
import { inspectTypeDependencies } from '../core/types.js';
import { ensureDir, isPathInside, readFile, scanDir, writeFile } from '../shared/files.js';
import { logger } from '../shared/logger.js';
import { timestamp, writeReport } from '../shared/reports.js';
import { claimOutput, validateMigrationPaths } from '../shared/safety.js';
import { runAnalyze } from './analyze.js';
import { runValidate } from './validate.js';

function sleep(milliseconds) {
    return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}

function isRetryable(error) {
    const message = (error.message || '').toLowerCase();
    return error.status === 429
        || message.includes('rate limit')
        || message.includes('overload')
        || message.includes('temporarily unavailable');
}

async function convertWithRetry(content, filePath, config, context) {
    let lastError;
    const sourceLineCount = content.split('\n').length;

    for (let attempt = 1; attempt <= config.aiMaxRetries; attempt += 1) {
        try {
            const result = await convertWithAI(content, filePath, config, context);
            if (!isTruncated(result.content, sourceLineCount)) return result;
            lastError = new Error('AI output appears incomplete');
        } catch (error) {
            lastError = error;
            if (!isRetryable(error)) break;
        }

        if (attempt < config.aiMaxRetries) {
            const wait = isRetryable(lastError)
                ? config.aiRateLimitWaitS * 1000
                : config.aiRequestDelayMs * attempt;
            await sleep(wait);
        }
    }

    throw lastError || new Error('AI conversion failed');
}

function dependencyExcerpts(imports, graphRoot) {
    const excerpts = [];
    for (const dependency of imports.slice(0, 2)) {
        const candidates = [dependency, `${dependency}.ts`, `${dependency}.tsx`];
        const dependencyPath = candidates
            .map(candidate => join(graphRoot, candidate))
            .find(candidate => existsSync(candidate));
        if (!dependencyPath) continue;
        excerpts.push(`// ${dependency}\n${readFileSync(dependencyPath, 'utf8').slice(0, 500)}`);
    }
    return excerpts;
}

export async function runMigrate(options = {}) {
    const config = loadConfig(options);
    const sourceDir = requireSource(config);
    validateMigrationPaths(sourceDir, config.outputDir, {
        allowUnownedOutput: config.dryRun,
    });

    const runTimestamp = timestamp();
    const analysis = await runAnalyze({
        source: sourceDir,
        reports: config.reportsDir,
        writeReport: true,
        runTimestamp,
    });
    if (!analysis.summary.totalFiles) {
        throw new Error('No JavaScript or JSX files were found in the source directory.');
    }

    if (config.dryRun) {
        logger.success('Dry run completed. No migration output was created.');
        return { dryRun: true, analysis: analysis.summary };
    }

    if (!config.skipAi && config.aiApiKey && !config.aiModel) {
        throw new Error('AI_MODEL or --ai-model is required when AI enhancement is enabled.');
    }

    claimOutput(sourceDir, config.outputDir);
    ensureDir(config.reportsDir);
    ensureDir(config.logsDir);
    await runMechanicalMigration(sourceDir, config.outputDir, config.skipDirs);

    const typeDependencies = await inspectTypeDependencies(config.outputDir);
    const aliases = resolvePathAliases(sourceDir);
    const aliasPaths = aliasesToTsConfigPaths(aliases, sourceDir, config.outputDir);
    const dependencyData = await buildDependencyGraph(config.outputDir);
    saveDepsReport(dependencyData, config.reportsDir);
    const brokenImports = detectBrokenImports(dependencyData.graph);

    const protectedRoots = config.skipDirs.map(directory => join(config.outputDir, directory));
    const files = scanDir(config.outputDir, ['.ts', '.tsx'])
        .filter(file => !protectedRoots.some(root => file === root || isPathInside(root, file)));
    const stats = {
        total: files.length,
        success: 0,
        failed: 0,
        manualReview: 0,
        aiProcessed: 0,
        aiTokens: 0,
        errors: [],
        recommendedTypePackages: typeDependencies.recommended,
    };
    const fileLog = [];
    const limit = pLimit(config.concurrency);

    await Promise.all(files.map(filePath => limit(async () => {
        const relativePath = relative(config.outputDir, filePath).replace(/\\/g, '/');
        const entry = { file: relativePath, status: 'pending', steps: [] };
        try {
            const original = readFile(filePath);
            const codemod = applyCodemods(original);
            let transformed = codemod.content;
            entry.steps.push({ name: 'codemod', changes: codemod.changes });

            const lineCount = transformed.split('\n').length;
            const aiEnabled = !config.skipAi && Boolean(config.aiApiKey);
            if (aiEnabled && lineCount <= config.aiMaxFileLines) {
                const dependencyContext = getFileContext(filePath, dependencyData.graph, config.outputDir);
                const result = await convertWithRetry(transformed, relativePath, config, {
                    reactContext: formatReactContextForAI(analyzeReactFile(filePath, transformed)),
                    astContext: analyzeFileAST(filePath),
                    depContext: dependencyContext,
                    depContents: dependencyExcerpts(dependencyContext.imports || [], config.outputDir),
                    brokenImports: brokenImports.filter(item => item.in === relativePath),
                });
                transformed = result.content;
                stats.aiProcessed += 1;
                stats.aiTokens += result.tokens || 0;
                entry.steps.push({ name: 'ai', model: result.model, tokens: result.tokens || 0 });
            } else if (aiEnabled && lineCount > config.aiMaxFileLines) {
                stats.manualReview += 1;
                entry.steps.push({ name: 'ai', status: 'manual-review', reason: 'file-too-large' });
            } else {
                entry.steps.push({ name: 'ai', status: 'disabled' });
            }

            transformed = await formatContent(filePath, transformed);
            writeFile(filePath, transformed);
            entry.status = 'success';
            stats.success += 1;
        } catch (error) {
            entry.status = 'failed';
            entry.error = error.message;
            stats.failed += 1;
            stats.errors.push({ file: relativePath, error: error.message });
        }
        fileLog.push(entry);
    })));

    const validation = await runValidate({
        output: config.outputDir,
        reports: config.reportsDir,
        strict: config.tsStrict,
        paths: aliasPaths,
    }, runTimestamp);
    const typeReview = await runMetrics(config.outputDir, config.reportsDir, runTimestamp);
    writeReport(config.logsDir, 'migration', {
        settings: {
            aiEnabled: !config.skipAi && Boolean(config.aiApiKey),
            aiProvider: config.aiProvider,
            aiModel: config.aiModel || null,
            strict: config.tsStrict,
            concurrency: config.concurrency,
        },
        stats,
        validation: { passed: validation.passed, errorCount: validation.errorCount },
        typeReview: {
            anyCount: typeReview.anyCount,
            tsExpectErrorCount: typeReview.tsExpectErrorCount,
        },
        files: fileLog.sort((left, right) => left.file.localeCompare(right.file)),
    }, runTimestamp);

    logger.success(`Migration completed: ${stats.success} successful, ${stats.failed} failed`);
    return stats;
}
