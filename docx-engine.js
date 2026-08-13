const hex = (value = '#f6f2e9') => value.replace(/^#/u, '').toUpperCase();

export function paragraphTokenGroups(tokens) {
    const groups = [[]];
    for (const token of tokens) {
        if (token.character === '\n') groups.push([]);
        else groups.at(-1).push(token);
    }
    return groups;
}

export function wordTextRuns(tokens, blankStyle = 'underline') {
    return tokens.map((token) => token.character === '\n'
        ? { text: '', break: 1 }
        : { text: token.blank ? (blankStyle === 'space' ? '　　' : '____') : token.character, break: undefined });
}

export function createWordDocument(tokens, options = {}) {
    const library = globalThis.docx;
    if (!library?.Document || !library?.Paragraph || !library?.TextRun) throw new Error('DOCX 库尚未载入');
    const { Document, Paragraph, TextRun, AlignmentType } = library;
    const title = options.title || '课堂默写';
    const meta = options.meta || '';
    const font = options.fontFamily || '宋体';
    const paragraphMode = options.paragraphMode === 'page' ? 'page' : 'newline';
    const bodyParagraphs = paragraphTokenGroups(tokens).map((paragraphTokens, index) => new Paragraph({
        children: wordTextRuns(paragraphTokens, options.blankStyle).map((run) => new TextRun({ text: run.text, break: run.break, font, size: Math.round((options.fontSize || 32) * 1.5) })),
        spacing: {
            line: Math.round((options.lineHeight || 1.8) * 320),
            after: paragraphMode === 'newline' ? Math.round((options.fontSize || 32) * 14) : 0
        },
        pageBreakBefore: paragraphMode === 'page' && index > 0
    }));
    return new Document({
        background: { color: hex(options.background) },
        sections: [{
            properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
            children: [
                new Paragraph({ text:title, alignment:AlignmentType.CENTER, heading:'Title' }),
                ...(meta ? [new Paragraph({ text:meta, alignment:AlignmentType.CENTER })] : []),
                ...bodyParagraphs
            ]
        }]
    });
}

export async function downloadWordDocument(tokens, options = {}) {
    const library = globalThis.docx;
    const wordDocument = createWordDocument(tokens, options);
    const blob = await library.Packer.toBlob(wordDocument);
    const link = globalThis.document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = options.filename || '课堂默写.docx';
    link.click();
    requestAnimationFrame(() => requestAnimationFrame(() => URL.revokeObjectURL(url)));
}
