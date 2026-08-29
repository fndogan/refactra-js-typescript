/**
 * STEP 2d: TSConfig Path Alias Resolver
 *
 * Reads path aliases from the source project's vite.config.js / tsconfig.json
 * and injects them into:
 *   1. The output/ tsconfig.json (so tsc can resolve @features/... etc.)
 *   2. The madge config (so dependency graph works correctly)
 *
 * Supports:
 *   - vite.config.js  → resolve.alias
 *   - tsconfig.json   → compilerOptions.paths
 *   - webpack.config.js → resolve.alias
 *
 * No AI tokens — purely local file parsing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { logger } from '../shared/logger.js';

// ── Readers ───────────────────────────────────────────────────────────────────

/**
 * Reads aliases from vite.config.js using regex (no eval/require risk).
 * Returns: { '@features': './src/features', '@shared': './src/shared', ... }
 */
function readViteAliases(sourceDir) {
    const vitePath = join(sourceDir, '..', 'vite.config.js');
    const vitePath2 = join(sourceDir, '..', 'vite.config.ts');
    const file = existsSync(vitePath) ? vitePath : existsSync(vitePath2) ? vitePath2 : null;
    if (!file) return {};

    const content = readFileSync(file, 'utf-8');
    const aliases = {};

    // Match: '@features': path.resolve(__dirname, 'src/features')
    // Match: '@features': './src/features'
    const aliasBlock = content.match(/alias\s*:\s*\{([^}]+)\}/s);
    if (!aliasBlock) return {};

    const pairs = aliasBlock[1].matchAll(
        /['"]([^'"]+)['"]\s*:\s*(?:path\.resolve\([^,)]+,\s*['"]([^'"]+)['"]\)|['"]([^'"]+)['"])/g
    );

    for (const [, alias, pathResolved, pathDirect] of pairs) {
        const rawPath = pathResolved || pathDirect;
        if (rawPath) {
            // Normalize to relative from sourceDir parent (project root)
            const absPath = resolve(join(sourceDir, '..'), rawPath);
            aliases[alias] = absPath;
            logger.debug(`  Path alias: ${alias} → ${rawPath}`);
        }
    }

    return aliases;
}

/**
 * Reads aliases from tsconfig.json compilerOptions.paths.
 */
function readTsConfigPaths(sourceDir) {
    const tsPath = join(sourceDir, '..', 'tsconfig.json');
    const tsPath2 = join(sourceDir, 'tsconfig.json');
    const file = existsSync(tsPath) ? tsPath : existsSync(tsPath2) ? tsPath2 : null;
    if (!file) return {};

    try {
        const tsconfig = JSON.parse(readFileSync(file, 'utf-8'));
        const paths = tsconfig?.compilerOptions?.paths || {};
        const aliases = {};
        const baseUrl = tsconfig?.compilerOptions?.baseUrl || '.';
        const base = resolve(dirname(file), baseUrl);

        for (const [alias, targets] of Object.entries(paths)) {
            const cleanAlias = alias.replace('/*', '');
            const target = (targets[0] || '').replace('/*', '');
            aliases[cleanAlias] = resolve(base, target);
        }

        return aliases;
    } catch {
        return {};
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Collects all path aliases from the source project.
 * Returns combined map: { '@features': '/abs/path/to/features', ... }
 *
 * Priority: tsconfig.json > vite.config.js
 */
export function resolvePathAliases(sourceDir) {
    const viteAliases = readViteAliases(sourceDir);
    const tsAliases = readTsConfigPaths(sourceDir);
    const combined = { ...viteAliases, ...tsAliases };

    logger.info(`Path aliases resolved: ${Object.keys(combined).join(', ') || 'none'}`);
    return combined;
}

/**
 * Converts alias map to tsconfig paths format relative to outputDir.
 *
 * Input:  { '@features': '/abs/path/src/features' }
 * Output: { '@features/*': ['./features/*'] }  (relative to outputDir)
 */
export function aliasesToTsConfigPaths(aliases, sourceDir, outputDir) {
    const paths = {};
    for (const [alias, absPath] of Object.entries(aliases)) {
        const sourceRelative = relative(sourceDir, absPath);
        const migratedPath = sourceRelative.startsWith('..')
            ? absPath
            : join(outputDir, sourceRelative);
        const rel = './' + relative(outputDir, migratedPath).replace(/\\/g, '/');
        paths[`${alias}/*`] = [`${rel}/*`];
        paths[alias] = [rel];
    }
    return paths;
}

/**
 * Converts alias map to madge alias format.
 *
 * Input:  { '@features': '/abs/path/src/features' }
 * Output: { '@features': '/abs/path/src/features' }  (madge uses absolute paths)
 */
export function aliasesToMadgeAliases(aliases) {
    return { ...aliases };
}
