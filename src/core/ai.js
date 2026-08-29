import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getCached, setCached } from './cache.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROMPT = resolve(currentDir, '../../prompts/system.example.txt');

function loadSystemPrompt(promptFile) {
    return readFileSync(promptFile || DEFAULT_PROMPT, 'utf8');
}

export async function convertWithAI(jsContent, filePath, config, context = {}) {
    if (!config.aiApiKey) {
        throw new Error(`Missing API key for AI provider: ${config.aiProvider}`);
    }
    if (!config.aiModel) {
        throw new Error('An AI model is required. Use --ai-model or set AI_MODEL.');
    }

    const systemPrompt = loadSystemPrompt(config.aiPromptFile);
    const userPrompt = buildUserPrompt(jsContent, filePath, context);
    const cached = getCached(userPrompt, config.aiModel);
    if (cached) return { ...cached, fromCache: true };

    const result = config.aiProvider === 'anthropic'
        ? await convertWithAnthropic(systemPrompt, userPrompt, config)
        : await convertWithOpenAI(systemPrompt, userPrompt, config);

    setCached(userPrompt, config.aiModel, result);
    return result;
}

async function convertWithAnthropic(systemPrompt, userPrompt, config) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.aiApiKey });
    const response = await client.messages.create({
        model: config.aiModel,
        max_tokens: config.aiMaxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
    });
    const text = response.content.find(block => block.type === 'text')?.text || '';

    return {
        content: extractCode(text),
        model: response.model,
        tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    };
}

async function convertWithOpenAI(systemPrompt, userPrompt, config) {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: config.aiApiKey });
    const response = await client.chat.completions.create({
        model: config.aiModel,
        max_tokens: config.aiMaxTokens,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    });

    return {
        content: extractCode(response.choices[0]?.message?.content || ''),
        model: response.model,
        tokens: response.usage?.total_tokens || 0,
    };
}

export function buildUserPrompt(jsContent, filePath, context = {}) {
    const isJsx = /\.(jsx|tsx)$/i.test(filePath) || /<[A-Z]|<[a-z]+[\s/>]/.test(jsContent);
    const sourceLanguage = isJsx ? 'JSX' : 'JavaScript';
    const targetLanguage = isJsx ? 'TSX' : 'TypeScript';
    const sections = [];

    if (context.reactContext) sections.push(context.reactContext);
    if (context.astContext?.anyTypes?.length) {
        sections.push([
            'Locations requiring explicit type review:',
            ...context.astContext.anyTypes.slice(0, 10)
                .map(item => `- line ${item.line}: ${item.content}`),
        ].join('\n'));
    }
    if (context.depContext?.imports?.length) {
        sections.push([
            'Local dependencies:',
            ...context.depContext.imports.slice(0, 5).map(item => `- ${item}`),
        ].join('\n'));
    }
    if (context.depContents?.length) {
        sections.push(`Dependency excerpts:\n${context.depContents.join('\n---\n')}`);
    }
    if (context.brokenImports?.length) {
        sections.push([
            'Imports whose JavaScript extension should be removed:',
            ...context.brokenImports.map(item => `- ${item.from} -> ${item.fix}`),
        ].join('\n'));
    }

    const contextBlock = sections.length ? `\n\nContext:\n${sections.join('\n\n')}` : '';
    return `Convert this ${sourceLanguage} file to ${targetLanguage} without changing behavior.${contextBlock}\n\nFile: ${filePath}\n\n\`\`\`${isJsx ? 'jsx' : 'javascript'}\n${jsContent}\n\`\`\`\n\nReturn only the complete converted file in one ${isJsx ? 'tsx' : 'typescript'} code block.`;
}

export function extractCode(text) {
    if (!text) return '';
    const match = text.match(/```(?:typescript|tsx|ts|javascript|jsx|js)?\s*\n([\s\S]*?)```/);
    return (match ? match[1] : text).trim();
}

export function isTruncated(code, sourceLineCount = 0) {
    if (!code || code.length < 10) return true;
    const lines = code.split('\n');
    const opens = (code.match(/\{/g) || []).length;
    const closes = (code.match(/\}/g) || []).length;
    if (opens !== closes) return true;
    if (sourceLineCount > 100 && lines.length < sourceLineCount * 0.7) return true;

    const lastLine = code.trimEnd().split('\n').pop() || '';
    return Boolean(lastLine && !/[;{}\]\)>'"`]\s*$/.test(lastLine));
}
