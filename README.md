# Refactra: JavaScript to TypeScript

[![CI](https://github.com/fndogan/refactra-js-typescript/actions/workflows/ci.yml/badge.svg)](https://github.com/fndogan/refactra-js-typescript/actions/workflows/ci.yml)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Refactra JavaScript to TypeScript is a review-first migration toolkit for JavaScript and JSX projects. It copies source files into a dedicated output directory, applies conservative mechanical transforms, optionally requests type enhancements from a configured AI provider, runs TypeScript validation, and produces review reports.

This repository is an early public beta. Generated code must be reviewed and tested as application code before it is merged.

## What it does

- Analyzes JavaScript and JSX files without modifying the source tree.
- Copies and renames source files with a local, deterministic migration step.
- Preserves project path aliases discovered in Vite or TypeScript configuration.
- Builds a dependency graph and reports circular or broken imports.
- Applies a conservative import-extension codemod.
- Supports optional Anthropic or OpenAI enhancement with an explicit model choice.
- Skips AI conversion for oversized files instead of splitting code at unsafe boundaries.
- Runs TypeScript validation and records remaining review markers.
- Never creates commits or changes branches in the project being migrated.

## Requirements

- Node.js 22 or 24 LTS
- npm
- Git, if you want to review the generated output on a separate branch
- An API key only when optional AI enhancement is enabled

## Installation

```bash
git clone https://github.com/fndogan/refactra-js-typescript.git
cd refactra-js-typescript
npm install
npm link
```

Run the CLI directly without linking:

```bash
node bin/cli.js --help
```

## Quick start

Analyze a project first:

```bash
refactra-js analyze --source ../my-project/src
```

Preview a migration without creating output:

```bash
refactra-js migrate \
  --source ../my-project/src \
  --output ./output \
  --dry-run
```

Run a local migration without AI:

```bash
refactra-js migrate \
  --source ../my-project/src \
  --output ./output \
  --no-ai
```

The output directory must be empty on its first run. Refactra places a small ownership marker in that directory and refuses to reuse it for a different source project.

## Optional AI enhancement

AI is disabled when the selected provider has no API key. When enabled, both an API key and an explicit model identifier are required so the repository does not depend on a hardcoded or outdated model name.

```bash
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your-key
export AI_MODEL=your-model-id

refactra-js migrate \
  --source ../my-project/src \
  --output ./output
```

For OpenAI, set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `AI_MODEL`.

When AI enhancement is enabled, the current file and small excerpts from up to two local dependencies are sent to the selected provider. Prompts and responses are cached locally in `.ai-cache/`, which is excluded from Git. Do not enable AI for code you are not authorized to send to that provider.

The packaged prompt is intentionally generic. To use a private prompt without committing it:

```bash
export AI_PROMPT_FILE=/absolute/path/to/private-prompt.txt
```

## Commands

| Command | Purpose |
| --- | --- |
| `refactra-js analyze` | Score migration complexity and write an analysis report |
| `refactra-js migrate` | Create and validate migration output |
| `refactra-js validate` | Run TypeScript validation on existing output |
| `refactra-js diff` | Compare original and migrated files |
| `refactra-js report` | Combine the latest analysis, migration, validation, and review reports |

Use `refactra-js <command> --help` for all options.

## Configuration

Copy `.env.example` to `.env`, or provide the same values through the environment.

| Variable | Purpose | Default |
| --- | --- | --- |
| `SOURCE_DIR` | JavaScript or JSX source directory | Required unless `--source` is used |
| `OUTPUT_DIR` | Dedicated migration output | `./output` |
| `REPORTS_DIR` | Analysis and validation reports | `./reports` |
| `LOGS_DIR` | Per-file migration log | `./logs` |
| `SKIP_DIRS` | Comma-separated source-relative directories to preserve | Empty |
| `AI_PROVIDER` | `anthropic` or `openai` | `anthropic` |
| `AI_MODEL` | Explicit provider model identifier | Empty |
| `AI_PROMPT_FILE` | Optional private prompt override | Packaged generic prompt |
| `AI_MAX_FILE_LINES` | Files above this size require manual review | `1000` |
| `CONCURRENCY` | Concurrent file transforms | `2` |
| `TS_STRICT` | Enable strict validation | `true` |

See [.env.example](./.env.example) for the complete list.

## Output and reports

The source directory is read-only. Generated TypeScript is written to the output directory. Reports use timestamped JSON files:

```text
reports/
  analysis/
  type-review/
  validation/
  dependency_graph.json
logs/
  migration/
```

The type-review report counts `any`, `unknown`, `@ts-expect-error`, and `@ts-ignore` markers. It is a review aid, not a type-coverage percentage.

## Project structure

```text
bin/                  CLI entry point
prompts/              Generic packaged prompt
src/commands/         User-facing commands
src/core/             Migration and analysis components
src/shared/           File, logging, and report utilities
test/                 Unit and safety tests
```

## Safety model

- Source and output directories cannot be the same or contain one another.
- A non-empty output directory is rejected unless it has a matching Refactra ownership marker.
- Dry runs do not create migration output.
- API keys are never included in migration reports.
- Large files are marked for manual review rather than converted in syntactically unsafe chunks.
- Missing compiler dependencies fail with a clear error instead of invoking an unpinned network install.
- The tool does not run `git add`, create commits, reset files, or change branches.

## Development

```bash
npm ci
npm run lint
npm test
npm pack --dry-run
```

Contributions should include tests for behavior and safety changes. See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

## Refactra projects

- [Refactra: MySQL to SQLAlchemy](https://github.com/fndogan/refactra-mysql-sqlalchemy)
- [Refactra: JavaScript to TypeScript](https://github.com/fndogan/refactra-js-typescript)

## Author and license

Created and maintained by [Furkan Dogan](https://github.com/fndogan). Licensed under the [MIT License](./LICENSE).
