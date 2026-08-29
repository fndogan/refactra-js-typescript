import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { aliasesToTsConfigPaths } from '../src/core/aliases.js';

test('maps source aliases into the migration output tree', () => {
    const source = resolve('/tmp/example/src');
    const output = resolve('/tmp/example-output');
    const paths = aliasesToTsConfigPaths({
        '@components': join(source, 'components'),
    }, source, output);

    assert.deepEqual(paths, {
        '@components/*': ['./components/*'],
        '@components': ['./components'],
    });
});
