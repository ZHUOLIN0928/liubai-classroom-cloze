import { existsSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, '..');
const rootDirectory = resolve(projectDirectory, '..', '..');
const defaultDatabasePath = resolve(rootDirectory, 'backend/data/lnk-lumen.sqlite3');
const defaultOutputPath = resolve(projectDirectory, 'content-library.json');

function option(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : null;
}

function absoluteWithinProject(value) {
    const path = resolve(projectDirectory, value);
    const pathRelative = relative(projectDirectory, path);
    if (!pathRelative || pathRelative.startsWith('..') || pathRelative.includes('/../')) {
        throw new Error('输出文件必须位于 classroom-cloze-studio 项目内');
    }
    return path;
}

function codePointOffset(source, codeUnitIndex) {
    return Array.from(source.slice(0, codeUnitIndex)).length;
}

function buildWorks(db) {
    const works = db.prepare(`
        SELECT
            w.id, w.title, w.author, w.dynasty, w.genre, w.source_text, w.curriculum_order,
            COALESCE((
                SELECT CASE c.stage WHEN 'junior' THEN '初中' WHEN 'senior' THEN '高中' ELSE c.stage END
                FROM catalog_work_entries e JOIN content_catalogs c ON c.id = e.catalog_id
                WHERE e.work_id = w.id ORDER BY c.stage, e.position LIMIT 1
            ), '内容库') AS stage
        FROM works w
        WHERE w.content_status IN ('reviewed', 'published')
        ORDER BY w.curriculum_order, w.title
    `).all();
    const segments = db.prepare(`
        SELECT id, work_id, position, text
        FROM segments ORDER BY work_id, position
    `).all();
    const links = db.prepare(`
        SELECT kl.work_id, kl.segment_id, kl.token_index, kl.token, sense.word_class
        FROM content_knowledge_links kl
        JOIN content_knowledge_senses sense ON sense.id = kl.knowledge_sense_id
        WHERE kl.content_status IN ('reviewed', 'published')
          AND kl.link_type = 'lexical_occurrence'
          AND sense.word_class IN ('实词', '虚词')
        ORDER BY kl.work_id, kl.segment_id, kl.token_index
    `).all();
    const segmentsByWork = new Map();
    for (const segment of segments) {
        if (!segmentsByWork.has(segment.work_id)) segmentsByWork.set(segment.work_id, []);
        segmentsByWork.get(segment.work_id).push(segment);
    }
    const linksBySegment = new Map();
    for (const link of links) {
        if (!linksBySegment.has(link.segment_id)) linksBySegment.set(link.segment_id, []);
        linksBySegment.get(link.segment_id).push(link);
    }
    let droppedAnchorCount = 0;
    const exported = works.map((work) => {
        const source = String(work.source_text ?? '');
        let searchFrom = 0;
        const anchors = [];
        for (const segment of segmentsByWork.get(work.id) ?? []) {
            const locatedAt = source.indexOf(segment.text, searchFrom);
            if (locatedAt < 0) {
                droppedAnchorCount += (linksBySegment.get(segment.id) ?? []).length;
                continue;
            }
            searchFrom = locatedAt + segment.text.length;
            for (const link of linksBySegment.get(segment.id) ?? []) {
                const characterStart = codePointOffset(source, locatedAt) + Number(link.token_index);
                anchors.push({
                    term: link.token,
                    start: characterStart,
                    type: link.word_class === '虚词' ? 'function' : 'content'
                });
            }
        }
        return {
            id: work.id, title: work.title, author: work.author ?? '', dynasty: work.dynasty ?? '',
            stage: work.stage, genre: work.genre ?? '', text: source, anchors
        };
    });
    return { works: exported, linkCount: links.length, droppedAnchorCount };
}

export function exportLnkLibrary({ databasePath = defaultDatabasePath, outputPath = defaultOutputPath } = {}) {
    if (!existsSync(databasePath)) throw new Error(`找不到内容库：${databasePath}`);
    const db = new DatabaseSync(databasePath, { readOnly: true });
    try {
        const exported = buildWorks(db);
        const payload = {
            schemaVersion: 'lnk-lumen-classroom-library-v1',
            generatedAt: new Date().toISOString(),
            source: 'Lnk Lumen 本机 SQLite（只读导出）',
            works: exported.works
        };
        writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, 'utf8');
        return { workCount: payload.works.length, linkCount: exported.linkCount, droppedAnchorCount: exported.droppedAnchorCount, outputPath };
    } finally {
        db.close();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const outputPath = option('--out') ? absoluteWithinProject(option('--out')) : defaultOutputPath;
    const result = exportLnkLibrary({ databasePath: option('--db') ? resolve(option('--db')) : defaultDatabasePath, outputPath });
    process.stdout.write(`${JSON.stringify(result)}\n`);
}
