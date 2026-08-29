/**
 * Central Reporter Utility
 *
 * All reports follow this structure:
 *   reports/<module>/<module>_YYYY-MM-DD_HH-mm-ss.json
 *
 * No AI tokens — purely local file I/O.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Returns a file-safe timestamp string: 2026-03-06_18-39-25
 */
export function timestamp() {
    return new Date()
        .toISOString()
        .replace('T', '_')
        .replace(/:/g, '-')
        .slice(0, 19); // YYYY-MM-DD_HH-mm-ss
}

/**
 * Writes a report JSON to: reportsDir/<module>/<module>_<timestamp>.json
 * Returns the full path of the written file.
 *
 * @param {string} reportsDir  - base reports/ directory
 * @param {string} module      - subdirectory + filename prefix (e.g. 'validation', 'codemods')
 * @param {object} data        - the report payload
 * @param {string} [ts]        - optional shared timestamp (so all reports in one run share it)
 */
export function writeReport(reportsDir, module, data, ts) {
    const runTs = ts || timestamp();
    const dir = join(reportsDir, module);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${module}_${runTs}.json`);
    writeFileSync(filePath, JSON.stringify({ _module: module, _generated: runTs, ...data }, null, 2));
    return filePath;
}
