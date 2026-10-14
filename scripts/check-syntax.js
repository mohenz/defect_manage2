const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const collectJsTargets = (relativeDir) => {
    const targets = [];
    const rootDir = path.join(projectRoot, relativeDir);

    if (!fs.existsSync(rootDir)) {
        return targets;
    }

    const walk = (currentRelativeDir) => {
        const currentFullDir = path.join(projectRoot, currentRelativeDir);
        const entries = fs.readdirSync(currentFullDir, { withFileTypes: true });

        for (const entry of entries) {
            const entryRelativePath = path.join(currentRelativeDir, entry.name);

            if (entry.isDirectory()) {
                walk(entryRelativePath);
                continue;
            }

            if (entry.isFile() && entry.name.endsWith('.js')) {
                targets.push(entryRelativePath);
            }
        }
    };

    walk(relativeDir);
    return targets.sort();
};

const targets = [
    'server.js',
    'config/playwright.config.js',
    'config/vitest.config.js',
    ...collectJsTargets('js')
];

let hasFailure = false;

for (const relativeTarget of targets) {
    const fullPath = path.join(projectRoot, relativeTarget);

    if (!fs.existsSync(fullPath)) {
        console.error(`[check:syntax] Missing file: ${relativeTarget}`);
        hasFailure = true;
        continue;
    }

    const result = spawnSync(process.execPath, ['--check', fullPath], {
        encoding: 'utf8'
    });

    if (result.status === 0) {
        console.log(`[check:syntax] OK ${relativeTarget}`);
        continue;
    }

    hasFailure = true;
    console.error(`[check:syntax] FAIL ${relativeTarget}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
}

if (hasFailure) {
    process.exit(1);
}

console.log('[check:syntax] All syntax checks passed.');
