import { readFileSync } from 'node:fs';

import { scanDir } from '../shared/files.js';
import { logger } from '../shared/logger.js';

const KNOWN_TYPES = {
    react: '@types/react',
    'react-dom': '@types/react-dom',
    lodash: '@types/lodash',
    'lodash-es': '@types/lodash',
    express: '@types/express',
    cors: '@types/cors',
    multer: '@types/multer',
    'body-parser': '@types/body-parser',
    'js-cookie': '@types/js-cookie',
    qs: '@types/qs',
    dompurify: '@types/dompurify',
    'file-saver': '@types/file-saver',
};

const BUILT_IN_TYPES = new Set([
    'axios',
    'date-fns',
    'dayjs',
    'formik',
    'immer',
    'jotai',
    'react-hook-form',
    'typescript',
    'vite',
    'yup',
    'zod',
    'zustand',
]);

export function resolveTypesPackages(importedPackages) {
    const recommended = [];
    const unresolved = [];

    for (const packageName of importedPackages) {
        if (BUILT_IN_TYPES.has(packageName)) continue;
        if (KNOWN_TYPES[packageName]) recommended.push(KNOWN_TYPES[packageName]);
        else unresolved.push(packageName);
    }

    return {
        recommended: [...new Set(recommended)].sort(),
        unresolved: [...new Set(unresolved)].sort(),
    };
}

export function extractImportedPackages(content) {
    const packages = new Set();
    const patterns = [
        /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
        /(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const raw = match[1];
            if (raw.startsWith('.') || raw.startsWith('/') || raw.startsWith('node:')) continue;
            if (raw.startsWith('@/') || raw.startsWith('~/')) continue;
            packages.add(raw.startsWith('@')
                ? raw.split('/').slice(0, 2).join('/')
                : raw.split('/')[0]);
        }
    }

    return packages;
}

export async function inspectTypeDependencies(outputDir) {
    const files = scanDir(outputDir, ['.ts', '.tsx', '.js', '.jsx']);
    const packages = new Set();

    for (const file of files) {
        const content = readFileSync(file, 'utf8');
        for (const packageName of extractImportedPackages(content)) packages.add(packageName);
    }

    const result = {
        importedPackages: [...packages].sort(),
        ...resolveTypesPackages(packages),
    };
    if (result.recommended.length) {
        logger.info(`Recommended type packages: ${result.recommended.join(', ')}`);
    }
    return result;
}
