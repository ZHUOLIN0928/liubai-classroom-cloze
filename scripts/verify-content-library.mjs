import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootDirectory = resolve(projectDirectory, '..', '..');
const payload = JSON.parse(readFileSync(resolve(projectDirectory, 'content-library.json'), 'utf8'));
const db = new DatabaseSync(resolve(rootDirectory, 'backend/data/lnk-lumen.sqlite3'), { readOnly: true });
try {
    const expectedWorks = db.prepare("SELECT count(*) AS count FROM works WHERE content_status IN ('reviewed', 'published')").get().count;
    const expectedAnchors = db.prepare(`
        SELECT count(*) AS count FROM content_knowledge_links kl
        JOIN content_knowledge_senses sense ON sense.id = kl.knowledge_sense_id
        WHERE kl.content_status IN ('reviewed', 'published')
          AND kl.link_type = 'lexical_occurrence'
          AND sense.word_class IN ('实词', '虚词')
    `).get().count;
    const actualWorks = Array.isArray(payload.works) ? payload.works.length : 0;
    const actualAnchors = Array.isArray(payload.works) ? payload.works.reduce((sum, work) => sum + (work.anchors?.length ?? 0), 0) : 0;
    if (actualWorks !== expectedWorks) throw new Error(`作品数不一致：${actualWorks}/${expectedWorks}`);
    if (actualAnchors !== expectedAnchors) throw new Error(`词类位置数不一致：${actualAnchors}/${expectedAnchors}`);
    const invalidAnchors = payload.works.flatMap((work) => {
        const characters = Array.from(work.text ?? '');
        return (work.anchors ?? []).filter((anchor) => (
            !Number.isInteger(anchor.start)
            || !['content', 'function'].includes(anchor.type)
            || characters.slice(anchor.start, anchor.start + Array.from(anchor.term ?? '').length).join('') !== anchor.term
        )).map((anchor) => ({ workId: work.id, anchor }));
    });
    if (invalidAnchors.length) throw new Error(`存在 ${invalidAnchors.length} 个无效词类位置`);
    process.stdout.write(`${JSON.stringify({ verified: true, workCount: actualWorks, anchorCount: actualAnchors, invalidAnchorCount: invalidAnchors.length, schemaVersion: payload.schemaVersion })}\n`);
} finally {
    db.close();
}
