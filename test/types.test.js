import assert from 'node:assert/strict';
import test from 'node:test';

import { extractImportedPackages, resolveTypesPackages } from '../src/core/types.js';

test('extracts external dependencies without reporting local aliases', () => {
    const packages = extractImportedPackages([
        "import React from 'react';",
        "import { value } from './local.js';",
        "import component from '@/components/Card';",
        "const parser = require('@scope/parser');",
        "const lazy = import('lodash/map');",
        "import fs from 'node:fs';",
    ].join('\n'));

    assert.deepEqual([...packages].sort(), ['@scope/parser', 'lodash', 'react']);
});

test('reports known type packages without installing them', () => {
    assert.deepEqual(resolveTypesPackages(['react', 'axios', 'unknown-package']), {
        recommended: ['@types/react'],
        unresolved: ['unknown-package'],
    });
});
