import {
    copyFileSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readdirSync,
} from 'node:fs';
import { join, relative } from 'node:path';

import { logger } from '../shared/logger.js';

function hasTypeScriptFiles(directory) {
    try {
        return readdirSync(directory).some(file => /\.tsx?$/.test(file));
    } catch {
        return false;
    }
}

export function copySourceToOutput(sourceDir, outputDir, skipDirs = []) {
    let copied = 0;
    function copyDirectory(source, destination) {
        const sourceRelative = relative(sourceDir, source).replace(/\\/g, '/');
        const protectedDirectory = skipDirs.some(directory =>
            sourceRelative === directory || sourceRelative.startsWith(`${directory}/`)
        );
        if (protectedDirectory && existsSync(destination) && hasTypeScriptFiles(destination)) {
            logger.info(`Skipping protected directory: ${sourceRelative}`);
            return;
        }

        mkdirSync(destination, { recursive: true });
        for (const entry of readdirSync(source)) {
            if (entry === 'node_modules') continue;
            const sourcePath = join(source, entry);
            const stat = lstatSync(sourcePath);
            if (stat.isSymbolicLink()) continue;

            if (stat.isDirectory()) {
                copyDirectory(sourcePath, join(destination, entry));
            } else if (/\.jsx?$/.test(entry)) {
                const targetName = entry.endsWith('.jsx')
                    ? entry.replace(/\.jsx$/, '.tsx')
                    : entry.replace(/\.js$/, '.ts');
                const targetPath = join(destination, targetName);
                if (!existsSync(targetPath)) {
                    copyFileSync(sourcePath, targetPath);
                    copied += 1;
                }
            }
        }
    }

    copyDirectory(sourceDir, outputDir);
    return copied;
}

export async function runMechanicalMigration(sourceDir, outputDir, skipDirs = []) {
    const copied = copySourceToOutput(sourceDir, outputDir, skipDirs);
    logger.success(`Copied and renamed ${copied} source files.`);
    return { outputDir, copied };
}
