/**
 * AST Layer — ts-morph based
 *
 * Operates on the real AST rather than regexes.
 * Used for props inference, hook return types, and function signature extraction.
 * Gives AI precise structural context before type inference begins.
 */

import { Project, SyntaxKind } from 'ts-morph';
import { logger } from '../shared/logger.js';

// ── Project Builder ───────────────────────────────────────────────────────────

/**
 * Creates a ts-morph Project for a directory.
 * allowJs remains enabled so mixed JavaScript and TypeScript context can be analyzed.
 */
export function createProject(dirPath, tsConfigPath = null) {
    const project = new Project({
        tsConfigFilePath: tsConfigPath || undefined,
        addFilesFromTsConfig: !!tsConfigPath,
        skipAddingFilesFromTsConfig: !tsConfigPath,
        compilerOptions: {
            allowJs: true,
            checkJs: false,
            jsx: 4,   // JsxEmit.ReactJSX
            target: 99,  // ScriptTarget.ESNext
            module: 99,  // ModuleKind.ESNext
            moduleResolution: 100, // ModuleResolutionKind.Bundler
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
            noEmit: true,
            strict: false, // Disabled during AST phase — strict is for validate step
        },
    });

    if (!tsConfigPath) {
        project.addSourceFilesAtPaths([`${dirPath}/**/*.ts`, `${dirPath}/**/*.tsx`]);
    }

    return project;
}

// ── Function Signature Extractor ──────────────────────────────────────────────

/**
 * Extracts all function signatures from a source file.
 * Provided to AI as context: "this function returns X."
 */
export function extractFunctionSignatures(sourceFile) {
    const signatures = [];

    for (const fn of sourceFile.getFunctions()) {
        signatures.push({
            name: fn.getName() || '(anonymous)',
            params: fn.getParameters().map(p => ({
                name: p.getName(),
                type: p.getType().getText(),
            })),
            returnType: fn.getReturnType().getText(),
            isAsync: fn.isAsync(),
            isExported: fn.isExported(),
        });
    }

    // Arrow functions stored in variable declarations
    for (const varDecl of sourceFile.getVariableDeclarations()) {
        const init = varDecl.getInitializer();
        if (init && (init.getKind() === SyntaxKind.ArrowFunction ||
            init.getKind() === SyntaxKind.FunctionExpression)) {
            signatures.push({
                name: varDecl.getName(),
                kind: 'arrow',
                returnType: init.getType?.()?.getText?.() || 'unknown',
                isExported: varDecl.getVariableStatement()?.isExported() || false,
            });
        }
    }

    return signatures;
}

// ── Import Extractor ──────────────────────────────────────────────────────────

/**
 * Extracts all imports from a source file.
 * Used by deps/graph.js and types-installer.
 */
export function extractImports(sourceFile) {
    return sourceFile.getImportDeclarations().map(imp => ({
        moduleSpecifier: imp.getModuleSpecifierValue(),
        defaultImport: imp.getDefaultImport()?.getText(),
        namedImports: imp.getNamedImports().map(n => n.getName()),
        isRelative: imp.getModuleSpecifierValue().startsWith('.'),
    }));
}

// ── Interface Extractor ───────────────────────────────────────────────────────

/**
 * Extracts existing TypeScript interfaces from a source file.
 * Added to AI prompt: "these interfaces already exist — do not redefine them."
 */
export function extractInterfaces(sourceFile) {
    return sourceFile.getInterfaces().map(iface => ({
        name: iface.getName(),
        properties: iface.getProperties().map(p => ({
            name: p.getName(),
            type: p.getType().getText(),
            optional: p.hasQuestionToken(),
        })),
    }));
}

// ── Any Type Scanner ──────────────────────────────────────────────────────────

/**
 * Finds all `any` and `@ts-expect-error` usages in a file.
 * Shown to AI: "replace these with real types."
 */
export function scanForAnyTypes(sourceFile) {
    const findings = [];
    const lines = sourceFile.getFullText().split('\n');

    lines.forEach((line, idx) => {
        if (line.includes(': any') || line.includes('as any') || line.includes('@ts-expect-error')) {
            findings.push({
                line: idx + 1,
                content: line.trim(),
                kind: line.includes('@ts-expect-error') ? 'ts-expect-error' : 'any',
            });
        }
    });

    return findings;
}

// ── Full File Analysis ────────────────────────────────────────────────────────

/**
 * Performs a complete AST analysis of a TS/TSX file.
 * Result is appended to the AI prompt as structural context.
 */
export function analyzeFileAST(filePath, project = null) {
    try {
        let proj = project;
        if (!proj) {
            proj = new Project({
                compilerOptions: { allowJs: true, skipLibCheck: true, noEmit: true },
                skipAddingFilesFromTsConfig: true,
            });
            proj.addSourceFileAtPath(filePath);
        }

        const sf = proj.getSourceFile(filePath);
        if (!sf) return null;

        return {
            filePath,
            functions: extractFunctionSignatures(sf),
            imports: extractImports(sf),
            interfaces: extractInterfaces(sf),
            anyTypes: scanForAnyTypes(sf),
            lineCount: sf.getEndLineNumber(),
        };
    } catch (err) {
        logger.warn(`AST analysis failed (${filePath}): ${err.message}`);
        return null;
    }
}
