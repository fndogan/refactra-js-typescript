import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const roots = ['bin', 'scripts', 'src', 'test'];
const files = [];

function collect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) collect(path);
        else if (entry.isFile() && path.endsWith('.js')) files.push(path);
    }
}

function importSpecifiers(source) {
    const specifiers = [];
    const staticImport = /^\s*(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
    const sideEffectImport = /^\s*import\s+['"]([^'"]+)['"];?/gm;

    for (const match of source.matchAll(staticImport)) specifiers.push(match[1]);
    for (const match of source.matchAll(sideEffectImport)) specifiers.push(match[1]);

    for (const line of source.split(/\r?\n/)) {
        const trimmed = line.trimStart();
        if (/^['"`]/.test(trimmed)) continue;
        for (const match of line.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            specifiers.push(match[1]);
        }
    }
    return specifiers;
}

function resolvesImport(file, specifier) {
    const base = resolve(dirname(file), specifier);
    return [
        base,
        `${base}.js`,
        `${base}.mjs`,
        `${base}.cjs`,
        `${base}.json`,
        join(base, 'index.js'),
    ].some(candidate => existsSync(candidate));
}

for (const root of roots) collect(root);
for (const file of files.sort()) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout);
        process.exitCode = 1;
    }

    const source = readFileSync(file, 'utf8');
    for (const specifier of importSpecifiers(source)) {
        if (specifier.startsWith('.') && !resolvesImport(file, specifier)) {
            console.error(`Unresolved relative import in ${file}: ${specifier}`);
            process.exitCode = 1;
        }
    }
}

if (!process.exitCode) {
    console.log(`Checked syntax and relative imports in ${files.length} JavaScript files.`);
}
