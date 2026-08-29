import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isPathInside } from './files.js';

const OUTPUT_MARKER = '.refactra-migration.json';

function sourceFingerprint(sourceDir) {
    return createHash('sha256').update(resolve(sourceDir)).digest('hex');
}

export function validateMigrationPaths(sourceDir, outputDir, options = {}) {
    if (!existsSync(sourceDir)) throw new Error(`Source directory does not exist: ${sourceDir}`);
    if (!lstatSync(sourceDir).isDirectory()) throw new Error(`Source path is not a directory: ${sourceDir}`);
    if (sourceDir === outputDir || isPathInside(sourceDir, outputDir) || isPathInside(outputDir, sourceDir)) {
        throw new Error('Source and output directories must be separate and must not contain one another.');
    }

    if (options.allowUnownedOutput || !existsSync(outputDir)) return;
    if (!lstatSync(outputDir).isDirectory()) throw new Error(`Output path is not a directory: ${outputDir}`);
    const entries = readdirSync(outputDir);
    if (!entries.length) return;

    const markerPath = join(outputDir, OUTPUT_MARKER);
    if (!existsSync(markerPath)) {
        throw new Error('Output directory is not empty and is not owned by Refactra. Choose a new directory.');
    }
    let marker;
    try {
        marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    } catch {
        throw new Error('Output directory contains an invalid Refactra ownership marker.');
    }
    if (marker.sourceFingerprint !== sourceFingerprint(sourceDir)) {
        throw new Error('Output directory belongs to a different migration source.');
    }
}

export function claimOutput(sourceDir, outputDir) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, OUTPUT_MARKER), `${JSON.stringify({
        format: 1,
        sourceFingerprint: sourceFingerprint(sourceDir),
    }, null, 2)}\n`);
}
