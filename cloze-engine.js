export const BLANK_STYLES = Object.freeze(['underline', 'box', 'space']);

export function normaliseText(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n');
}

export function createTokens(text, anchors = []) {
    const typeByIndex = new Map();
    const source = normaliseText(text);
    const characters = Array.from(source);
    for (const anchor of anchors) {
        const term = String(anchor?.term ?? '');
        if (!term) continue;
        const type = anchor.type === 'function' ? 'function' : 'content';
        const anchoredStart = Number(anchor?.start);
        if (Number.isInteger(anchoredStart) && anchoredStart >= 0) {
            const length = Array.from(term).length;
            for (let index = anchoredStart; index < anchoredStart + length; index += 1) {
                if (characters[index] !== undefined) typeByIndex.set(index, type);
            }
            continue;
        }
        let from = 0;
        while (from < source.length) {
            const found = source.indexOf(term, from);
            if (found < 0) break;
            for (let index = found; index < found + term.length; index += 1) {
                typeByIndex.set(index, type);
            }
            from = found + term.length;
        }
    }
    return characters.map((character, index) => ({
        index,
        character,
        type: typeByIndex.get(index) ?? null,
        blank: false
    }));
}

export function cloneTokens(tokens) {
    return tokens.map((token) => ({ ...token }));
}

export function isPunctuation(token) {
    return /^\p{P}$/u.test(token.character);
}

export function isBlankable(token) {
    return token.character !== '\n' && !/^\s$/u.test(token.character) && !isPunctuation(token);
}

export function applyRule(tokens, rule, options = {}, random = Math.random) {
    const next = cloneTokens(tokens);
    const blank = (index) => {
        if (next[index] && isBlankable(next[index])) next[index].blank = true;
    };
    if (rule === 'clear') return next.map((token) => ({ ...token, blank: false }));
    if (rule === 'random') {
        const ratio = Math.max(0, Math.min(1, Number(options.ratio ?? 0.3)));
        const candidates = next.filter(isBlankable);
        const target = Math.round(candidates.length * ratio);
        const shuffled = [...candidates].sort(() => random() - 0.5);
        shuffled.slice(0, target).forEach((token) => blank(token.index));
    }
    if (rule === 'sentence-start' || rule === 'sentence-end') {
        const count = Math.max(1, Math.min(12, Number(options.count ?? 2)));
        const sentences = normaliseText(next.map((token) => token.character).join('')).split(/(?<=[。！？；])/u);
        let cursor = 0;
        for (const sentence of sentences) {
            const indexes = Array.from(sentence).map((character, offset) => cursor + offset)
                .filter((index) => isBlankable(next[index]));
            const picked = rule === 'sentence-start' ? indexes.slice(0, count) : indexes.slice(-count);
            picked.forEach(blank);
            cursor += Array.from(sentence).length;
        }
    }
    if (rule === 'content' || rule === 'function') {
        next.forEach((token) => {
            if (token.type === rule) blank(token.index);
        });
    }
    return next;
}

export function toggleRange(tokens, start, end, force = null) {
    const next = cloneTokens(tokens);
    const first = Math.min(start, end);
    const last = Math.max(start, end);
    for (let index = first; index <= last; index += 1) {
        if (isBlankable(next[index])) next[index].blank = force ?? !next[index].blank;
    }
    return next;
}

export function blankedPlainText(tokens, blankStyle = 'underline') {
    const marker = blankStyle === 'box' ? '□' : blankStyle === 'space' ? '　' : '＿';
    return tokens.map((token) => token.blank ? marker : token.character).join('');
}

export function safeFilename(value) {
    return String(value ?? '课堂挖空').trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 70) || '课堂挖空';
}
