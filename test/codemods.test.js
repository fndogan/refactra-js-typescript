import assert from 'node:assert/strict';
import test from 'node:test';

import { applyCodemods, fixImportExtensions } from '../src/core/codemods.js';

test('removes JavaScript extensions only from local module references', () => {
    const source = [
        "import value from './value.js';",
        "export { item } from '../item.jsx';",
        "import remote from 'package.js';",
    ].join('\n');
    const result = fixImportExtensions(source);

    assert.match(result, /from '\.\/value'/);
    assert.match(result, /from '\.\.\/item'/);
    assert.match(result, /from 'package\.js'/);
});

test('reports whether a conservative codemod changed content', () => {
    assert.deepEqual(applyCodemods("import x from './x.js';").changes, [
        'removed JavaScript extensions from local imports',
    ]);
    assert.deepEqual(applyCodemods('const x = 1;').changes, []);
});
