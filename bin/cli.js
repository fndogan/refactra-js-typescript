#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(currentDir, '../package.json'), 'utf8'));

const COMMANDS = {
    analyze: {
        description: 'Analyze JavaScript and JSX migration complexity',
        values: { '--source': 'source', '-s': 'source', '--output': 'output', '-o': 'output' },
        flags: { '--json': ['json', true] },
    },
    migrate: {
        description: 'Copy, transform, optionally enhance, and validate a migration',
        values: {
            '--source': 'source', '-s': 'source',
            '--output': 'output', '-o': 'output',
            '--ai-provider': 'aiProvider', '--ai-model': 'aiModel',
            '--concurrency': 'concurrency',
        },
        flags: {
            '--dry-run': ['dryRun', true],
            '--no-strict': ['strict', false],
            '--no-ai': ['ai', false],
        },
    },
    validate: {
        description: 'Run TypeScript validation on migration output',
        values: { '--output': 'output', '-o': 'output' },
        flags: { '--no-strict': ['strict', false] },
    },
    report: {
        description: 'Generate a combined migration report',
        values: {
            '--output': 'output', '-o': 'output',
            '--logs': 'logs', '-l': 'logs',
            '--format': 'format',
        },
        flags: {},
    },
    diff: {
        description: 'Compare original JavaScript with migrated TypeScript',
        values: {
            '--source': 'source', '-s': 'source',
            '--output': 'output', '-o': 'output',
            '--file': 'file', '-f': 'file',
        },
        flags: {},
    },
};

function printHelp(command) {
    if (command && COMMANDS[command]) {
        console.log(`refactra-js ${command}\n\n${COMMANDS[command].description}`);
        console.log('\nUse environment variables or the options listed in README.md.');
        return;
    }
    console.log(`Refactra JavaScript to TypeScript ${pkg.version}\n`);
    console.log('Usage: refactra-js <command> [options]\n');
    console.log('Commands:');
    for (const [name, definition] of Object.entries(COMMANDS)) {
        console.log(`  ${name.padEnd(10)} ${definition.description}`);
    }
    console.log('\nRun refactra-js <command> --help for command details.');
}

export function parseCommandOptions(command, args) {
    const definition = COMMANDS[command];
    if (!definition) throw new Error(`Unknown command: ${command}`);
    const options = {};

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--help' || argument === '-h') {
            options.help = true;
            continue;
        }
        if (definition.flags[argument]) {
            const [name, value] = definition.flags[argument];
            options[name] = value;
            continue;
        }

        const [optionName, inlineValue] = argument.split('=', 2);
        const name = definition.values[optionName];
        if (!name) throw new Error(`Unknown option for ${command}: ${argument}`);
        const value = inlineValue ?? args[index + 1];
        if (!value || (!inlineValue && value.startsWith('-'))) {
            throw new Error(`Missing value for option: ${optionName}`);
        }
        options[name] = value;
        if (inlineValue === undefined) index += 1;
    }
    return options;
}

async function run(command, options) {
    if (command === 'analyze') {
        const { runAnalyze } = await import('../src/commands/analyze.js');
        return runAnalyze({ ...options, reports: options.output, writeReport: true });
    }
    if (command === 'migrate') {
        const { runMigrate } = await import('../src/commands/migrate.js');
        return runMigrate(options);
    }
    if (command === 'validate') {
        const { runValidate } = await import('../src/commands/validate.js');
        return runValidate(options);
    }
    if (command === 'report') {
        const { runReport } = await import('../src/commands/report.js');
        return runReport({ ...options, reports: options.output });
    }
    const { runDiff } = await import('../src/commands/diff.js');
    return runDiff(options);
}

async function main() {
    const [command, ...args] = process.argv.slice(2);
    if (!command || command === '--help' || command === '-h') {
        printHelp();
        return;
    }
    if (command === '--version' || command === '-V') {
        console.log(pkg.version);
        return;
    }

    const options = parseCommandOptions(command, args);
    if (options.help) {
        printHelp(command);
        return;
    }
    await run(command, options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
    });
}
