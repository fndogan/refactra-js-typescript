/**
 * Diff Tool
 * Side-by-side comparison between original JS and migrated TS files.
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { collectJsFiles, isPathInside, mapOutputPath } from '../shared/files.js';
import { loadConfig, requireSource } from '../config.js';
import { logger } from '../shared/logger.js';

export async function runDiff(opts = {}) {
    const config = loadConfig(opts);
    const sourceDir = requireSource(config);

    if (opts.file) {
        const sourceFile = resolve(sourceDir, opts.file);
        if (!isPathInside(sourceDir, sourceFile)) {
            throw new Error('The requested file must be inside the source directory.');
        }
        const outputFile = mapOutputPath(sourceFile, sourceDir, config.outputDir);
        printFileDiff(sourceFile, outputFile);
    } else {
        const jsFiles = await collectJsFiles(sourceDir);
        let compared = 0;

        for (const jsFile of jsFiles) {
            const tsFile = mapOutputPath(jsFile, sourceDir, config.outputDir);
            if (existsSync(tsFile)) {
                printFileDiff(jsFile, tsFile);
                compared++;
            }
        }

        if (compared === 0) {
            logger.warn('No migrated files found. Run `migrate` first.');
        }
    }
}

function printFileDiff(sourceFile, outputFile) {
    if (!existsSync(sourceFile)) {
        logger.error(`Source not found: ${sourceFile}`);
        return;
    }
    if (!existsSync(outputFile)) {
        logger.warn(`Not yet migrated: ${basename(sourceFile)}`);
        return;
    }

    const original = readFileSync(sourceFile, 'utf-8').split('\n');
    const converted = readFileSync(outputFile, 'utf-8').split('\n');

    const filename = basename(sourceFile);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  ${filename}  (${original.length} lines -> ${converted.length} lines)`);
    console.log(`${'='.repeat(80)}\n`);

    const maxLines = Math.max(original.length, converted.length);
    const colWidth = 38;

    console.log(
        padEnd('ORIGINAL (.js)', colWidth) +
        ' | ' +
        'MIGRATED (.ts)'
    );
    console.log('-'.repeat(colWidth) + '-+-' + '-'.repeat(colWidth));

    for (let i = 0; i < Math.min(maxLines, 50); i++) {
        const left = original[i] ?? '';
        const right = converted[i] ?? '';

        console.log(`${padEnd(left, colWidth)} | ${padEnd(right, colWidth)}`);
    }

    if (maxLines > 50) {
        console.log(`... (${maxLines - 50} more lines)`);
    }
    console.log('');
}

function padEnd(str, len) {
    const truncated = str.length > len ? str.slice(0, len - 3) + '...' : str;
    return truncated.padEnd(len, ' ');
}
