import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { loadConfig } from '../config.js';
import { scanDir } from '../shared/files.js';
import { logger } from '../shared/logger.js';
import { writeReport } from '../shared/reports.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const TSC_BIN = resolve(currentDir, '../../node_modules/.bin/tsc');

export function generateTsConfig(outputDir, options = {}) {
    const strict = options.strict ?? true;
    const config = {
        compilerOptions: {
            target: options.target || 'ES2022',
            lib: [options.target || 'ES2022', 'DOM', 'DOM.Iterable'],
            module: options.module || 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            strict,
            noImplicitAny: strict,
            strictNullChecks: strict,
            strictFunctionTypes: strict,
            noImplicitReturns: strict,
            noFallthroughCasesInSwitch: true,
            resolveJsonModule: true,
            isolatedModules: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            forceConsistentCasingInFileNames: true,
            noEmit: true,
            skipLibCheck: true,
            baseUrl: '.',
            paths: options.paths || {},
        },
        include: ['./**/*.ts', './**/*.tsx'],
        exclude: ['node_modules'],
    };

    mkdirSync(outputDir, { recursive: true });
    const configPath = join(outputDir, 'tsconfig.json');
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    return configPath;
}

export async function runValidate(options = {}, runTimestamp) {
    const config = loadConfig(options);
    const tsFiles = scanDir(config.outputDir, ['.ts', '.tsx']);
    if (!tsFiles.length) {
        return { passed: false, totalFiles: 0, errorCount: 0, warnCount: 0, errors: [] };
    }
    if (!existsSync(TSC_BIN)) {
        throw new Error('TypeScript is not installed. Run npm install before validation.');
    }

    generateTsConfig(config.outputDir, {
        strict: config.tsStrict,
        target: config.tsTarget,
        module: config.tsModule,
        paths: options.paths,
    });
    const result = spawnSync(TSC_BIN, ['--noEmit', '--project', 'tsconfig.json'], {
        cwd: config.outputDir,
        encoding: 'utf8',
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    const errorLines = output.split('\n').filter(line => line.includes('error TS'));
    const warningLines = output.split('\n').filter(line => line.includes('warning TS'));
    const report = {
        outputDir: '.',
        totalFiles: tsFiles.length,
        errorCount: errorLines.length,
        warnCount: warningLines.length,
        passed: result.status === 0,
        errors: parseErrors(errorLines, config.outputDir),
    };

    const reportPath = writeReport(config.reportsDir, 'validation', report, runTimestamp);
    logger.info(`TypeScript validation: ${report.passed ? 'passed' : 'failed'} (${report.errorCount} errors)`);
    logger.success(`Validation report saved: ${reportPath}`);
    return report;
}

export function parseErrors(errorLines, outputDir = process.cwd()) {
    return errorLines.map(line => {
        const match = line.match(/^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
        if (!match) {
            return { raw: line.replaceAll(resolve(outputDir), '<output>') };
        }
        const file = relative(outputDir, resolve(outputDir, match[1])).replace(/\\/g, '/');
        return {
            file: file.startsWith('../') || file === '..' ? '<external>' : file,
            line: Number.parseInt(match[2], 10),
            column: Number.parseInt(match[3], 10),
            code: match[4],
            message: match[5],
        };
    });
}
