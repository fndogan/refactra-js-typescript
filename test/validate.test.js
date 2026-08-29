import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { parseErrors } from '../src/commands/validate.js';

test('keeps validation diagnostics relative to the migration output', () => {
    const output = join(process.cwd(), 'private-workspace', 'output');
    const diagnostic = `${join(output, 'src', 'index.ts')}(3,7): error TS2322: Type mismatch`;
    const [error] = parseErrors([diagnostic], output);

    assert.equal(error.file, 'src/index.ts');
    assert.doesNotMatch(JSON.stringify(error), new RegExp(output.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
