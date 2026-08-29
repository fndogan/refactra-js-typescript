import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { parseCommandOptions } from '../bin/cli.js';

test('parses migration options without hidden defaults', () => {
    assert.deepEqual(parseCommandOptions('migrate', [
        '--source', './src',
        '--output=./migration',
        '--no-ai',
        '--concurrency', '3',
    ]), {
        source: './src',
        output: './migration',
        ai: false,
        concurrency: '3',
    });
});

test('prints CLI help without loading migration dependencies', () => {
    const result = spawnSync(process.execPath, ['bin/cli.js', '--help'], {
        cwd: process.cwd(),
        encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Refactra JavaScript to TypeScript/);
    assert.match(result.stdout, /migrate/);
});
