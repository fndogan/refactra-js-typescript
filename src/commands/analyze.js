import { existsSync } from 'node:fs';
import { relative } from 'node:path';

import { loadConfig, requireSource } from '../config.js';
import { collectJsFiles, readFile } from '../shared/files.js';
import { logger } from '../shared/logger.js';
import { timestamp, writeReport } from '../shared/reports.js';

const PATTERNS = {
    reactComponent: /export\s+(?:default\s+)?(?:function|const)\s+[A-Z]/,
    reactHook: /export\s+(?:default\s+)?(?:function|const)\s+use[A-Z]/,
    reactContext: /createContext|useContext/,
    reactMemo: /React\.memo|useMemo|useCallback/,
    reactRef: /useRef|forwardRef/,
    asyncAwait: /async\s+(?:function|\(|[a-z])/,
    promiseChain: /\.then\s*\(|\.catch\s*\(/,
    propTypes: /PropTypes\.|\.propTypes\s*=/,
    defaultProps: /\.defaultProps\s*=/,
    stateManagement: /useSelector|useDispatch|createSlice|createAsyncThunk|create\s*\(\s*\(set/,
    apiCalls: /axios\.|fetch\s*\(|useQuery|useMutation/,
    dynamicImports: /React\.lazy|import\s*\(/,
    typeReview: /JSON\.parse|Object\.keys|Object\.values|as\s+any|@ts-ignore|@ts-nocheck/,
};

export function analyzeFile(filePath, sourceDir) {
    const content = readFile(filePath);
    const lines = content.split('\n').length;
    const patterns = Object.fromEntries(
        Object.entries(PATTERNS).map(([name, pattern]) => [name, pattern.test(content)])
    );

    let score = 0;
    if (patterns.propTypes) score += 20;
    if (patterns.defaultProps) score += 10;
    if (patterns.typeReview) score += 10;
    if (patterns.promiseChain) score += 5;
    if (patterns.reactRef) score += 15;
    if (patterns.stateManagement) score += 20;
    if (lines > 300) score += 15;
    if (lines > 600) score += 15;

    return {
        path: relative(sourceDir, filePath).replace(/\\/g, '/'),
        lines,
        complexity: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
        score,
        targetExtension: filePath.endsWith('.jsx') || patterns.reactComponent ? '.tsx' : '.ts',
        patterns,
    };
}

export async function runAnalyze(options = {}) {
    const config = loadConfig(options);
    const sourceDir = requireSource(config);
    if (!existsSync(sourceDir)) {
        throw new Error(`Source directory does not exist: ${sourceDir}`);
    }

    const sourceFiles = await collectJsFiles(sourceDir);
    const files = sourceFiles.map(file => analyzeFile(file, sourceDir));
    const summary = {
        totalFiles: files.length,
        tsxTargets: files.filter(file => file.targetExtension === '.tsx').length,
        tsTargets: files.filter(file => file.targetExtension === '.ts').length,
        highComplexity: files.filter(file => file.complexity === 'high').length,
        mediumComplexity: files.filter(file => file.complexity === 'medium').length,
        lowComplexity: files.filter(file => file.complexity === 'low').length,
        withPropTypes: files.filter(file => file.patterns.propTypes).length,
        withStateManagement: files.filter(file => file.patterns.stateManagement).length,
        withApiCalls: files.filter(file => file.patterns.apiCalls).length,
    };

    const report = { summary, files };
    logger.info(`Analyzed ${summary.totalFiles} JavaScript and JSX files`);
    logger.info(`Complexity: ${summary.highComplexity} high, ${summary.mediumComplexity} medium, ${summary.lowComplexity} low`);

    if (options.writeReport) {
        const path = writeReport(config.reportsDir, 'analysis', report, options.runTimestamp || timestamp());
        logger.success(`Analysis report saved: ${path}`);
    }
    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
    }

    return report;
}
