export const FORMAT_PRESETS = {
    '16:9': { label: '宽版', width: 1920, height: 1080 },
    '4:3': { label: '标准版', width: 1600, height: 1200 },
    'a4-landscape': { label: 'A4 横向', width: 1754, height: 1240 },
    'a4-portrait': { label: 'A4 纵向', width: 1240, height: 1754 }
};

export function ratioSpec(value = '16:9') {
    if (FORMAT_PRESETS[value]) return FORMAT_PRESETS[value];
    const match = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/u.exec(value);
    const left = Number(match?.[1]); const right = Number(match?.[2]);
    if (!left || !right) return FORMAT_PRESETS['16:9'];
    const max = 1920;
    return left >= right
        ? { label: value, width: max, height: Math.round(max * right / left) }
        : { label: value, width: Math.round(max * left / right), height: max };
}

function glyphWidth(character, fontSize) {
    if (/\s/u.test(character)) return fontSize * .42;
    if (/[，。；：、！？,.!?]/u.test(character)) return fontSize * .57;
    return fontSize * 1.03;
}

function createPage(spec, margins, headerHeight, footerHeight) {
    return {
        width: spec.width, height: spec.height, margins, headerHeight, footerHeight,
        items: [], lineCount: 0, paragraphIds: []
    };
}

function paragraphsFromTokens(tokens) {
    const paragraphs = [];
    let current = [];
    for (const token of tokens) {
        const character = token.character ?? token;
        if (character === '\n') {
            paragraphs.push({ tokens: current, separator: token });
            current = [];
        } else current.push(token);
    }
    paragraphs.push({ tokens: current, separator: null });
    return paragraphs;
}

function wrapParagraph(tokens, contentLeft, contentRight, fontSize) {
    const lines = [[]];
    let lineWidth = 0;
    for (const token of tokens) {
        const character = token.character ?? token;
        const width = glyphWidth(character, fontSize);
        if (lineWidth > 0 && contentLeft + lineWidth + width > contentRight) {
            lines.push([]);
            lineWidth = 0;
        }
        lines.at(-1).push({ token, character, width });
        lineWidth += width;
    }
    return lines;
}

/**
 * Produces a deterministic paragraph-aware layout in export pixels.
 * A fitting paragraph is never split across PNG pages; a paragraph that is
 * longer than a page continues on its own following page.
 */
export function paginateTokens(tokens, options = {}) {
    const spec = options.spec ?? ratioSpec(options.ratio);
    const fontSize = Math.max(18, Math.round(options.fontSize ?? 54));
    const lineHeight = Math.max(fontSize * 1.25, Math.round(fontSize * (options.lineHeight ?? 1.82)));
    const margin = Math.max(fontSize, Math.round(options.margin ?? Math.min(spec.width, spec.height) * .075));
    const headerHeight = Math.max(fontSize * 2.5, Math.round(options.headerHeight ?? margin * .95));
    const footerHeight = Math.max(fontSize * 1.7, Math.round(options.footerHeight ?? margin * .7));
    const paragraphMode = options.paragraphMode === 'page' ? 'page' : 'newline';
    const paragraphSpacing = Math.max(0, Math.round(options.paragraphSpacing ?? lineHeight * .55));
    const contentLeft = margin;
    const contentRight = spec.width - margin;
    const firstBaseline = margin + headerHeight + fontSize * 2.75;
    const contentBottom = spec.height - margin - footerHeight;
    const pages = [createPage(spec, margin, headerHeight, footerHeight)];
    let page = pages[0];
    let y = firstBaseline;

    const startPage = () => {
        page = createPage(spec, margin, headerHeight, footerHeight);
        pages.push(page);
        y = firstBaseline;
    };
    const lineFits = (baseline) => baseline + fontSize * .35 <= contentBottom;
    const paragraphFits = (lineCount) => lineFits(y + Math.max(0, lineCount - 1) * lineHeight);
    const pageIsEmpty = () => !page.items.some((item) => !item.newline);

    paragraphsFromTokens(tokens).forEach((paragraph, paragraphIndex) => {
        const lines = wrapParagraph(paragraph.tokens, contentLeft, contentRight, fontSize);
        const fitsFreshPage = lineFits(firstBaseline + Math.max(0, lines.length - 1) * lineHeight);

        if (paragraphMode === 'page' && paragraphIndex > 0 && !pageIsEmpty()) startPage();
        else if (paragraphMode === 'newline' && !pageIsEmpty() && fitsFreshPage && !paragraphFits(lines.length)) startPage();

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
            if (!lineFits(y)) startPage();
            let x = contentLeft;
            const line = lines[lineIndex];
            for (const entry of line) {
                page.items.push({ ...entry, x, y, newline: false, paragraphIndex });
                x += entry.width;
            }
            page.lineCount += 1;
            if (!page.paragraphIds.includes(paragraphIndex)) page.paragraphIds.push(paragraphIndex);
            if (lineIndex < lines.length - 1) y += lineHeight;
        }

        if (paragraph.separator) {
            page.items.push({ token: paragraph.separator, character: '\n', x: contentLeft, y, newline: true, paragraphIndex });
            y += lineHeight + paragraphSpacing;
        }
    });

    return {
        spec, fontSize, lineHeight, margin, headerHeight, footerHeight, paragraphMode, paragraphSpacing,
        pages: pages.filter((candidate, index) => candidate.items.length || index === 0)
    };
}

export function drawPage(canvas, page, options = {}) {
    const scale = Math.max(.1, options.scale ?? 1);
    canvas.width = Math.round(page.width * scale);
    canvas.height = Math.round(page.height * scale);
    const context = canvas.getContext('2d');
    context.scale(scale, scale);
    const theme = options.theme ?? { background: '#f4f0e6', ink: '#2b2b2b', muted: '#666666', rule: '#b2aa9b' };
    const pageNumber = options.pageNumber ?? 1;
    const pageCount = options.pageCount ?? 1;
    const fontFamily = options.fontFamily ?? '"Noto Serif SC", "Songti SC", STSong, serif';
    const blankStyle = options.blankStyle ?? 'underline';
    context.fillStyle = theme.background;
    context.fillRect(0, 0, page.width, page.height);
    if (options.meta) { context.textAlign = 'right'; context.fillStyle = theme.muted; context.font = `500 ${Math.round(page.headerHeight * .29)}px ui-sans-serif, system-ui, sans-serif`; context.fillText(options.meta, page.width - page.margins, page.margins + page.headerHeight * .42); context.textAlign = 'left'; }
    context.textAlign = 'center';
    context.fillStyle = theme.ink;
    context.font = `700 ${Math.round(page.fontSize ?? options.fontSize ?? 54) * 1.36}px ${fontFamily}`;
    context.fillText(options.title ?? '课堂默写', page.width / 2, page.margins + page.headerHeight + Math.round((page.fontSize ?? options.fontSize ?? 54) * .12));
    context.textAlign = 'left';
    context.font = `400 ${options.fontSize ?? 54}px ${fontFamily}`;
    context.fillStyle = theme.ink;
    context.strokeStyle = theme.ink;
    context.lineWidth = Math.max(1.5, (options.fontSize ?? 54) * .035);
    for (const item of page.items) {
        if (item.newline) continue;
        if (item.token?.blank) {
            const width = Math.max(item.width * .88, (options.fontSize ?? 54) * .72);
            if (blankStyle === 'box') context.strokeRect(item.x + 1, item.y - (options.fontSize ?? 54) * .82, width, (options.fontSize ?? 54) * .94);
            else if (blankStyle === 'underline') {
                context.beginPath(); context.moveTo(item.x + 1, item.y + (options.fontSize ?? 54) * .1);
                context.lineTo(item.x + width, item.y + (options.fontSize ?? 54) * .1); context.stroke();
            }
        } else context.fillText(item.character, item.x, item.y);
    }
    context.fillStyle = theme.muted;
    context.font = `500 ${Math.round(page.footerHeight * .4)}px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = 'center';
    if (options.showPageNumber !== false && pageCount > 1) context.fillText(`第 ${pageNumber} / ${pageCount} 页`, page.width / 2, page.height - page.margins * .44);
    context.textAlign = 'left';
}
