import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { copySourceToOutput } from '../src/core/copy.js';

test('copies JavaScript as TypeScript without following symlinks', t => {
    const root = mkdtempSync(join(process.cwd(), 'test-tmp-copy-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const source = join(root, 'source');
    const output = join(root, 'output');
    mkdirSync(join(source, 'components'), { recursive: true });
    writeFileSync(join(source, 'index.js'), 'export const value = 1;');
    writeFileSync(join(source, 'components', 'Card.jsx'), 'export const Card = () => <div />;');

    assert.equal(copySourceToOutput(source, output), 2);
    assert.equal(existsSync(join(output, 'index.ts')), true);
    assert.equal(existsSync(join(output, 'components', 'Card.tsx')), true);
    assert.equal(existsSync(join(output, 'index.js')), false);
});
