import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { isPathInside, mapOutputPath } from '../src/shared/files.js';

test('maps JavaScript source paths to TypeScript output paths', () => {
    const source = resolve('/tmp/project/src');
    const output = resolve('/tmp/project-migration');
    assert.equal(
        mapOutputPath(join(source, 'components', 'Card.jsx'), source, output),
        join(output, 'components', 'Card.tsx')
    );
    assert.equal(
        mapOutputPath(join(source, 'utils.js'), source, output),
        join(output, 'utils.ts')
    );
});

test('recognizes contained paths without treating siblings as children', () => {
    const parent = resolve('/tmp/project');
    assert.equal(isPathInside(parent, join(parent, 'src', 'index.js')), true);
    assert.equal(isPathInside(parent, resolve('/tmp/project-copy/index.js')), false);
    assert.equal(isPathInside(parent, parent), false);
});
