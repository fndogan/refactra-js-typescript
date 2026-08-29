import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { validateMigrationPaths } from '../src/shared/safety.js';

test('rejects nested output directories', t => {
    const root = mkdtempSync(join(process.cwd(), 'test-tmp-paths-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const source = join(root, 'source');
    mkdirSync(source);
    assert.throws(
        () => validateMigrationPaths(source, join(source, 'output')),
        /must be separate/
    );
});

test('rejects a non-empty unowned output directory', t => {
    const root = mkdtempSync(join(process.cwd(), 'test-tmp-output-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const source = join(root, 'source');
    const output = join(root, 'output');
    mkdirSync(source);
    mkdirSync(output);
    writeFileSync(join(output, 'existing.txt'), 'existing data');

    assert.throws(
        () => validateMigrationPaths(source, output),
        /not empty and is not owned/
    );
});
