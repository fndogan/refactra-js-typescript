# Contributing

Thank you for improving Refactra JavaScript to TypeScript.

## Development setup

```bash
npm ci
npm run check
```

Use a focused branch and keep commits small enough to review. A pull request should explain the migration behavior being changed, the safety impact, and the tests that cover it.

## Expectations

- Preserve source files; transformations must write only to owned output directories.
- Do not add hardcoded project paths, customer names, API keys, or private prompts.
- Do not add automatic Git commits, resets, checkouts, or branch changes.
- Prefer deterministic transforms. Any behavior-changing transform requires an explicit option and tests.
- Treat AI output as untrusted generated code and preserve a non-AI workflow.
- Update the README when a command, configuration value, or limitation changes.

## Reporting bugs

Open an issue with a minimal reproduction that contains no proprietary source code or credentials. Security issues should follow [SECURITY.md](./SECURITY.md).
