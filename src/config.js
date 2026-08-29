try {
    await import('dotenv/config');
} catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

import { resolve } from 'node:path';

const PROVIDERS = new Set(['anthropic', 'openai']);

function integer(value, fallback, minimum = 1) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

export function loadConfig(overrides = {}) {
    const provider = overrides.aiProvider || process.env.AI_PROVIDER || 'anthropic';
    if (!PROVIDERS.has(provider)) {
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    const source = overrides.source || process.env.SOURCE_DIR;
    const apiKey = provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY;

    return {
        sourceDir: source ? resolve(source) : null,
        outputDir: resolve(overrides.output || process.env.OUTPUT_DIR || './output'),
        reportsDir: resolve(overrides.reports || process.env.REPORTS_DIR || './reports'),
        logsDir: resolve(overrides.logs || process.env.LOGS_DIR || './logs'),
        skipDirs: (process.env.SKIP_DIRS || '')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
        aiProvider: provider,
        aiApiKey: apiKey || '',
        aiModel: overrides.aiModel || process.env.AI_MODEL || '',
        aiPromptFile: process.env.AI_PROMPT_FILE ? resolve(process.env.AI_PROMPT_FILE) : null,
        aiMaxTokens: integer(process.env.AI_MAX_TOKENS, 8192),
        aiRequestDelayMs: integer(process.env.AI_REQUEST_DELAY_MS, 250, 0),
        aiRateLimitWaitS: integer(process.env.AI_RATE_LIMIT_WAIT_S, 30),
        aiMaxRetries: integer(process.env.AI_MAX_RETRIES, 3),
        aiMaxFileLines: integer(process.env.AI_MAX_FILE_LINES, 1000),
        skipAi: overrides.ai === false || process.env.SKIP_AI === 'true',
        tsStrict: overrides.strict === false
            ? false
            : process.env.TS_STRICT !== 'false',
        tsTarget: process.env.TS_TARGET || 'ES2022',
        tsModule: process.env.TS_MODULE || 'ESNext',
        dryRun: Boolean(overrides.dryRun) || process.env.DRY_RUN === 'true',
        concurrency: integer(overrides.concurrency || process.env.CONCURRENCY, 2),
    };
}

export function requireSource(config) {
    if (!config.sourceDir) {
        throw new Error('A source directory is required. Use --source or set SOURCE_DIR.');
    }
    return config.sourceDir;
}
