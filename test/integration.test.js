import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dependenciesInstalled = existsSync(join(repositoryRoot, 'node_modules', 'p-limit', 'package.json'));

function collectText(directory) {
    if (!existsSync(directory)) return '';
    return readdirSync(directory, { withFileTypes: true })
        .map(entry => {
            const path = join(directory, entry.name);
            return entry.isDirectory() ? collectText(path) : readFileSync(path, 'utf8');
        })
        .join('\n');
}

test('runs a non-AI migration without changing source or leaking absolute paths', {
    skip: dependenciesInstalled ? false : 'requires npm ci',
}, t => {
    const root = mkdtempSync(join(tmpdir(), 'refactra-integration-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    const source = join(root, 'source');
    const output = join(root, 'output');
    const reports = join(root, 'reports');
    const logs = join(root, 'logs');
    mkdirSync(source);

    const sourcePath = join(source, 'index.js');
    const sourceContent = 'export const answer = 42;\n';
    writeFileSync(sourcePath, sourceContent);

    const result = spawnSync(process.execPath, [
        'bin/cli.js', 'migrate',
        '--source', source,
        '--output', output,
        '--no-ai',
    ], {
        cwd: repositoryRoot,
        env: { ...process.env, REPORTS_DIR: reports, LOGS_DIR: logs },
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readFileSync(sourcePath, 'utf8'), sourceContent);
    assert.match(readFileSync(join(output, 'index.ts'), 'utf8'), /answer = 42/);

    const artifacts = `${collectText(reports)}\n${collectText(logs)}`;
    assert.match(artifacts, /"passed": true/);
    assert.doesNotMatch(artifacts, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
