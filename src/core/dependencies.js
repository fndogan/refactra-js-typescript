/**
 * Dependency Graph — madge-based
 *
 * Builds the project's import map.
 * Gives AI the context: "this file imports data from these files."
 * Detects .ts files importing .js files (build-breaking after rename).
 */

import madge from 'madge';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { logger } from '../shared/logger.js';

// ── Dependency Graph Builder ──────────────────────────────────────────────────

/**
 * Builds a full dependency graph for a directory.
 * Returns: { graph, circular, orphans, stats }
 */
export async function buildDependencyGraph(dirPath) {
    logger.info(`Building dependency graph: ${dirPath}`);

    try {
        const result = await madge(dirPath, {
            fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
            excludeRegExp: [/node_modules/],
            detectiveOptions: {
                es6: { mixedImports: true },
                ts: { mixedImports: true },
            },
        });

        const graph = result.obj();
        const circular = result.circular();
        const orphans = result.orphans();

        const stats = {
            totalFiles: Object.keys(graph).length,
            circularCount: circular.length,
            orphanCount: orphans.length,
            avgDependencies: calcAvgDeps(graph),
        };

        logger.success(`Dependency graph complete: ${stats.totalFiles} files`);
        if (circular.length > 0) {
            logger.warn(`${circular.length} circular dependencies found!`);
        }

        return { graph, circular, orphans, stats };

    } catch (err) {
        logger.warn(`Dependency graph failed: ${err.message}`);
        return { graph: {}, circular: [], orphans: [], stats: {} };
    }
}

// ── File Context Builder (for AI) ─────────────────────────────────────────────

/**
 * Returns the files a given file depends on, and files that depend on it.
 * Used to provide dependency context during optional AI enhancement.
 */
export function getFileContext(filePath, graph, sourceDir) {
    const rel = relative(sourceDir, filePath).replace(/\\/g, '/');

    const dependsOn = graph[rel] || [];
    const dependedBy = Object.entries(graph)
        .filter(([, deps]) => deps.includes(rel))
        .map(([file]) => file);

    return {
        file: rel,
        imports: dependsOn,
        importedBy: dependedBy,
        depth: dependsOn.length,
    };
}

// ── Broken Import Detection (.ts file → .js reference) ───────────────────────

/**
 * After mechanical renaming, detects TypeScript files that still reference JavaScript files.
 * These break the build. AI prompt includes them as "fix these imports."
 */
export function detectBrokenImports(graph) {
    const broken = [];

    for (const [file, deps] of Object.entries(graph)) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

        for (const dep of deps) {
            if (dep.endsWith('.js') || dep.endsWith('.jsx')) {
                broken.push({
                    in: file,
                    from: dep,
                    fix: dep.replace(/\.(js|jsx)$/, ''),
                });
            }
        }
    }

    if (broken.length > 0) {
        logger.warn(`${broken.length} JavaScript-extension imports require review`);
    }

    return broken;
}

// ── Report ────────────────────────────────────────────────────────────────────

export function saveDepsReport(depData, reportsDir) {
    mkdirSync(reportsDir, { recursive: true });
    const path = join(reportsDir, 'dependency_graph.json');
    writeFileSync(path, JSON.stringify(depData, null, 2));
    logger.success(`Dependency graph report saved: ${path}`);
    return path;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAvgDeps(graph) {
    const counts = Object.values(graph).map(d => d.length);
    if (counts.length === 0) return 0;
    return (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(2);
}
