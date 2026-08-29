import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUserPrompt, extractCode, isTruncated } from '../src/core/ai.js';

test('extracts one complete fenced code block', () => {
    assert.equal(extractCode('```typescript\nconst value: number = 1;\n```'), 'const value: number = 1;');
});

test('builds a generic prompt from a relative file name', () => {
    const prompt = buildUserPrompt('export const value = 1;', 'utils/value.js');
    assert.match(prompt, /File: utils\/value\.js/);
});

test('flags empty and structurally incomplete AI output', () => {
    assert.equal(isTruncated(''), true);
    assert.equal(isTruncated('export function value() {\n  return 1;\n}'), false);
    assert.equal(isTruncated('export function value() {\n  if (true) {\n'), true);
});
