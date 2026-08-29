import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { scanDir } from '../shared/files.js';
import { logger } from '../shared/logger.js';
import { writeReport } from '../shared/reports.js';

export function countTypeReviewMarkers(outputDir) {
    const files = scanDir(outputDir, ['.ts', '.tsx']);
    const report = {
        totalFiles: files.length,
        anyCount: 0,
        unknownCount: 0,
        tsExpectErrorCount: 0,
        tsIgnoreCount: 0,
        files: [],
    };

    for (const file of files) {
        const content = readFileSync(file, 'utf8');
        const finding = {
            file: relative(outputDir, file).replace(/\\/g, '/'),
            anyCount: (content.match(/:\s*any\b|as\s+any\b/g) || []).length,
            unknownCount: (content.match(/:\s*unknown\b/g) || []).length,
            tsExpectErrorCount: (content.match(/@ts-expect-error/g) || []).length,
            tsIgnoreCount: (content.match(/@ts-ignore/g) || []).length,
        };
        report.anyCount += finding.anyCount;
        report.unknownCount += finding.unknownCount;
        report.tsExpectErrorCount += finding.tsExpectErrorCount;
        report.tsIgnoreCount += finding.tsIgnoreCount;
        if (finding.anyCount || finding.tsExpectErrorCount || finding.tsIgnoreCount) {
            report.files.push(finding);
        }
    }

    report.files.sort((left, right) =>
        (right.anyCount + right.tsExpectErrorCount + right.tsIgnoreCount)
        - (left.anyCount + left.tsExpectErrorCount + left.tsIgnoreCount)
    );
    return report;
}

export async function runMetrics(outputDir, reportsDir, runTimestamp) {
    const report = countTypeReviewMarkers(outputDir);
    const reportPath = writeReport(reportsDir, 'type-review', report, runTimestamp);
    logger.info(`Type review markers: ${report.anyCount} any, ${report.tsExpectErrorCount} ts-expect-error`);
    logger.success(`Type review report saved: ${reportPath}`);
    return report;
}
