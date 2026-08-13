import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(scriptDirectory, '..');
const runtimeDirectory = resolve(sourceDirectory, '.runtime');

function option(name) {
    const index = process.argv.indexOf(name);
    return index < 0 ? null : process.argv[index + 1] ?? null;
}

function requiredOption(name) {
    const value = option(name);
    if (!value) throw new Error(`Missing ${name}`);
    return resolve(value);
}

function inside(directory, target) {
    const path = relative(directory, target);
    return path && !path.startsWith('..') && !path.includes('/../');
}

async function readLibrary(path) {
    const payload = JSON.parse(await readFile(path, 'utf8'));
    if (payload?.schemaVersion !== 'lnk-lumen-classroom-library-v1') {
        throw new Error('Unsupported classroom content library schema');
    }
    if (!Array.isArray(payload.works) || payload.works.length === 0) {
        throw new Error('Classroom content library has no works');
    }
    return payload;
}

async function copyPublicSource(destination) {
    const ignored = new Set([
        '.git', '.runtime', 'content-library.json', 'content-library-data.js', 'node_modules'
    ]);
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
        if (ignored.has(entry.name)) continue;
        await cp(resolve(sourceDirectory, entry.name), resolve(destination, entry.name), {
            recursive: true
        });
    }
}

async function buildLibraryModule(payload, destination) {
    const source = [
        '// Generated during the private content release. Do not hand-edit.',
        `export const DEFAULT_LIBRARY = ${JSON.stringify(payload.works)};`,
        `export const CONTENT_LIBRARY_META = ${JSON.stringify({
            schemaVersion: payload.schemaVersion,
            generatedAt: payload.generatedAt,
            workCount: payload.works.length,
            source: 'Lnk Lumen classroom release'
        })};`,
        ''
    ].join('\n');
    await writeFile(resolve(destination, 'content-library.js'), source, 'utf8');
}

function createOfflineZip(siteDirectory, zipPath) {
    const result = spawnSync('zip', ['-q', '-r', zipPath, basename(siteDirectory)], {
        cwd: dirname(siteDirectory),
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        throw new Error(`Could not create offline ZIP: ${result.stderr || result.stdout}`);
    }
}

const contentPath = requiredOption('--content');
const outputDirectory = requiredOption('--out');
const offlineZip = requiredOption('--offline-zip');

if (
    (inside(sourceDirectory, outputDirectory) && !inside(runtimeDirectory, outputDirectory))
    || (inside(sourceDirectory, offlineZip) && !inside(runtimeDirectory, offlineZip))
) {
    throw new Error('Release output must be outside the public source directory or inside .runtime');
}

const payload = await readLibrary(contentPath);
await rm(outputDirectory, { recursive: true, force: true });
await rm(offlineZip, { force: true });
await copyPublicSource(outputDirectory);
await buildLibraryModule(payload, outputDirectory);
createOfflineZip(outputDirectory, offlineZip);

const zipSize = (await stat(offlineZip)).size;
process.stdout.write(`${JSON.stringify({
    outputDirectory,
    offlineZip,
    workCount: payload.works.length,
    zipSize
})}\n`);
