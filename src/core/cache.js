/**
 * AI Result Cache
 *
 * Caches AI conversion results by file content hash.
 * On re-runs: if file content unchanged → return cached result (zero AI tokens).
 * Cache stored in: .ai-cache/<sha256>.json
 *
 * Key: sha256(fileContent + aiModel)
 * Value: { content, tokens, model, cachedAt }
 */

import { createHash } from 'node:crypto';
import {
    existsSync, readFileSync, readdirSync,
    writeFileSync, mkdirSync, statSync
} from 'node:fs';
import { join } from 'node:path';
import { logger } from '../shared/logger.js';

const CACHE_DIR = join(process.cwd(), '.ai-cache');

function cacheKey(content, model) {
    return createHash('sha256').update(content + '||' + model).digest('hex');
}

/**
 * Returns cached AI result if available, otherwise null.
 * ZERO AI tokens on cache hit.
 */
export function getCached(content, model) {
    try {
        const key = cacheKey(content, model);
        const cachePath = join(CACHE_DIR, `${key}.json`);
        if (!existsSync(cachePath)) return null;
        const cached = JSON.parse(readFileSync(cachePath, 'utf-8'));
        logger.debug(`AI cache hit: ${key.slice(0, 8)}`);
        return cached;
    } catch {
        return null;
    }
}

/**
 * Stores an AI result in cache.
 */
export function setCached(content, model, result) {
    try {
        mkdirSync(CACHE_DIR, { recursive: true });
        const key = cacheKey(content, model);
        const cachePath = join(CACHE_DIR, `${key}.json`);
        writeFileSync(cachePath, JSON.stringify({
            ...result,
            cachedAt: new Date().toISOString(),
        }, null, 2));
    } catch { /* Cache write failure is non-fatal */ }
}

/**
 * Returns cache stats: total entries + total size on disk.
 */
export function cacheStats() {
    try {
        const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
        const totalSize = files.reduce((acc, f) => {
            try { return acc + statSync(join(CACHE_DIR, f)).size; } catch { return acc; }
        }, 0);
        return { entries: files.length, sizeMB: (totalSize / 1024 / 1024).toFixed(1) };
    } catch {
        return { entries: 0, sizeMB: '0.0' };
    }
}
