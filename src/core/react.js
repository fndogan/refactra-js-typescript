/**
 * React Props Extractor — react-docgen based
 *
 * Extracts prop types from React components.
 * Provides AI context: "this component has these props."
 * Also detects hook return types and context types.
 */

import * as reactDocgen from 'react-docgen';
import { readFileSync } from 'node:fs';
import { logger } from '../shared/logger.js';

// ── Props Extractor ───────────────────────────────────────────────────────────

/**
 * Extracts React component prop shapes from a JSX/TSX file.
 * react-docgen uses AST analysis — not regex.
 */
export function extractReactProps(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');

        if (!filePath.match(/\.(jsx|tsx)$/) && !/<[A-Z]/.test(content)) {
            return null;
        }

        const components = reactDocgen.parse(content, {
            filename: filePath,
            resolver: new reactDocgen.builtinResolvers.FindAllDefinitionsResolver(),
        });

        return components.map(comp => ({
            displayName: comp.displayName,
            description: comp.description,
            props: formatProps(comp.props || {}),
        }));

    } catch (err) {
        // react-docgen cannot parse all patterns (HOC, forwardRef, etc.) — skip gracefully
        logger.debug(`react-docgen skipped (${filePath}): ${err.message?.slice(0, 100)}`);
        return null;
    }
}

// ── Hook Return Type Analyzer ─────────────────────────────────────────────────

/**
 * Detects hook return type patterns in custom hook files.
 * Provides AI hints: "this hook returns [state, setState]"
 */
export function analyzeHookReturnTypes(content) {
    const hooks = [];
    const hookPattern = /(?:export\s+)?(?:function|const)\s+(use[A-Z][a-zA-Z]*)/g;
    let match;

    while ((match = hookPattern.exec(content)) !== null) {
        const hookName = match[1];
        const afterHook = content.slice(match.index);
        const returnMatch = afterHook.match(/return\s+(\{[^}]+\}|\[[^\]]+\]|[a-zA-Z_$][a-zA-Z0-9_$]*)/);

        hooks.push({
            name: hookName,
            returnHint: returnMatch?.[1]?.slice(0, 100) || 'unknown',
            returnsObject: returnMatch?.[1]?.startsWith('{') || false,
            returnsArray: returnMatch?.[1]?.startsWith('[') || false,
        });
    }

    return hooks;
}

// ── Context Type Detector ─────────────────────────────────────────────────────

/**
 * Finds createContext usages.
 * Tells AI: "this context carries this type."
 */
export function detectContextTypes(content) {
    const contexts = [];
    const pattern = /const\s+([A-Za-z]+Context)\s*=\s*createContext\s*\(([^)]*)\)/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
        contexts.push({
            name: match[1],
            defaultValue: match[2].trim() || 'null',
        });
    }

    return contexts;
}

// ── Full React Analysis ───────────────────────────────────────────────────────

/**
 * Performs a complete React analysis of a file.
 * Result is appended to the AI prompt as context.
 */
export function analyzeReactFile(filePath, content) {
    return {
        filePath,
        components: extractReactProps(filePath) || [],
        hooks: analyzeHookReturnTypes(content),
        contexts: detectContextTypes(content),
    };
}

// ── Context → AI Prompt String ────────────────────────────────────────────────

/**
 * Converts react-docgen analysis into a readable string for the AI prompt.
 */
export function formatReactContextForAI(analysis) {
    if (!analysis) return '';

    const lines = ['\n<!-- REACT COMPONENT CONTEXT (react-docgen) -->'];

    if (analysis.components?.length > 0) {
        lines.push('Detected prop shapes:');
        for (const comp of analysis.components) {
            lines.push(`  ${comp.displayName}:`);
            for (const [name, info] of Object.entries(comp.props)) {
                const req = info.required ? '(required)' : '(optional)';
                lines.push(`    - ${name}: ${info.type?.name || 'unknown'} ${req}`);
            }
        }
    }

    if (analysis.hooks?.length > 0) {
        lines.push('Hook return type hints:');
        for (const hook of analysis.hooks) {
            lines.push(`  ${hook.name} → ${hook.returnsObject ? 'object {}' : hook.returnsArray ? 'array []' : hook.returnHint}`);
        }
    }

    if (analysis.contexts?.length > 0) {
        lines.push('Contexts:');
        for (const ctx of analysis.contexts) {
            lines.push(`  ${ctx.name} — default: ${ctx.defaultValue}`);
        }
    }

    lines.push('<!-- END REACT CONTEXT -->');
    return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatProps(propsObj) {
    const result = {};
    for (const [name, info] of Object.entries(propsObj)) {
        result[name] = {
            type: info.type?.name || 'unknown',
            required: info.required || false,
            default: info.defaultValue?.value,
            desc: info.description,
        };
    }
    return result;
}
