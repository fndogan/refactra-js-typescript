import prettier from 'prettier';

import { logger } from '../shared/logger.js';

const PRETTIER_OPTIONS = {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'es5',
    printWidth: 100,
    arrowParens: 'avoid',
    endOfLine: 'lf',
};

export async function formatContent(filePath, content) {
    try {
        return await prettier.format(content, {
            ...PRETTIER_OPTIONS,
            parser: filePath.endsWith('.tsx') ? 'babel-ts' : 'typescript',
            filepath: filePath,
        });
    } catch (error) {
        logger.warn(`Formatting skipped for ${filePath}: ${error.message}`);
        return content;
    }
}
