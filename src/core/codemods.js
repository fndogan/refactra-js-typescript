export function fixImportExtensions(content) {
    return content.replace(
        /((?:from\s+|import\s*\(|require\s*\()\s*['"])(\.\.?\/[^'"]+)\.jsx?(['"])/g,
        '$1$2$3'
    );
}

export function applyCodemods(content) {
    const transformed = fixImportExtensions(content);
    return {
        content: transformed,
        changes: transformed === content ? [] : ['removed JavaScript extensions from local imports'],
    };
}
