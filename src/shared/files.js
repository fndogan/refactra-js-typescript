/**
 * File System utilities
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { isAbsolute, join, extname, relative, dirname } from 'node:path';
/** Collect all JS/JSX files recursively */
export async function collectJsFiles(sourceDir) {
    const files = [];

    function walk(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) continue;
            const path = join(directory, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules') walk(path);
            } else if (
                entry.isFile()
                && /\.jsx?$/.test(entry.name)
            ) {
                files.push(path);
            }
        }
    }

    walk(sourceDir);
    return files.sort();
}

/** Read file content safely */
export function readFile(filePath) {
    return readFileSync(filePath, 'utf-8');
}

/** Write file to output, creating parent directories */
export function writeFile(filePath, content, dryRun = false) {
    if (dryRun) return;
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
}

/** Map source path → output path (.js→.ts, .jsx→.tsx) */
export function mapOutputPath(sourceFile, sourceDir, outputDir) {
    const rel = relative(sourceDir, sourceFile);
    const tsRel = rel
        .replace(/\.jsx$/, '.tsx')
        .replace(/\.js$/, '.ts');
    return join(outputDir, tsRel);
}

/** Check if a file contains JSX syntax (heuristic) */
export function isJsxFile(content) {
    return /<[A-Z][a-zA-Z]*|<[a-z]+[\s/>]|React\.createElement/.test(content);
}

/** Ensure directory exists */
export function ensureDir(dir) {
    mkdirSync(dir, { recursive: true });
}

export function isPathInside(parent, child) {
    const rel = relative(parent, child);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** Scan directory recursively for matching extensions */
export function scanDir(dir, exts = ['.ts', '.tsx']) {
    const results = [];
    if (!existsSync(dir)) return results;

    function walk(current) {
        for (const entry of readdirSync(current)) {
            const full = join(current, entry);
            const stat = lstatSync(full);
            if (stat.isSymbolicLink()) continue;
            if (stat.isDirectory() && entry !== 'node_modules') {
                walk(full);
            } else if (stat.isFile() && exts.includes(extname(entry))) {
                results.push(full);
            }
        }
    }
    walk(dir);
    return results;
}
