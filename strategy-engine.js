import { cloneTokens, isBlankable } from './cloze-engine.js';

const reset = (tokens) => cloneTokens(tokens).map((token) => ({ ...token, blank: false }));
const blank = (tokens, index) => { if (isBlankable(tokens[index])) tokens[index].blank = true; };
const candidates = (tokens) => tokens.filter(isBlankable);

export function applyInterval(tokens, { gap = 1, length = 1 } = {}) {
    const next = reset(tokens); const items = candidates(next); const stepGap = Math.max(1, Number(gap)); const run = Math.max(1, Number(length));
    for (let cursor = 0; cursor < items.length; cursor += run + stepGap) for (let offset = 0; offset < run && cursor + offset < items.length; offset += 1) items[cursor + offset].blank = true;
    return next;
}
export function applyRandom(tokens, { ratio = .3, distribution = 'even' } = {}, random = Math.random) {
    const next = reset(tokens); const items = candidates(next); const target = Math.round(items.length * Math.max(0, Math.min(1, ratio)));
    if (!target) return next;
    if (distribution === 'even') { const step = items.length / target; for (let index = 0; index < target; index += 1) items[Math.min(items.length - 1, Math.floor(index * step + step / 2))].blank = true; return next; }
    const shuffled = [...items]; for (let index = shuffled.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]; } shuffled.slice(0, target).forEach((token) => { token.blank = true; }); return next;
}
export function applyWordType(tokens, { type = 'content', keepRatio = .2 } = {}, random = Math.random) {
    const next = reset(tokens); const keep = Math.max(0, Math.min(1, keepRatio)); next.forEach((token) => { if (token.type === type && isBlankable(token) && random() >= keep) token.blank = true; }); return next;
}
export function applySentenceEdges(tokens, { mode = 'start', count = 2 } = {}) {
    const next = reset(tokens); const amount = Math.max(1, Number(count)); let group = [];
    const flush = () => { const usable = group.filter((index) => isBlankable(next[index])); const selected = mode === 'end' ? usable.slice(-amount) : usable.slice(0, amount); selected.forEach((index) => blank(next,index)); group = []; };
    next.forEach((token,index) => { group.push(index); if (/[。！？；]/u.test(token.character) || token.character === '\n') flush(); }); flush(); return next;
}
export function applyMiddle(tokens) {
    const next = reset(tokens); let group = [];
    const flush = () => { const usable = group.filter((index) => isBlankable(next[index])); usable.slice(1,-1).forEach((index) => blank(next,index)); if (usable.length === 2) blank(next,usable[1]); group = []; };
    next.forEach((token,index) => { group.push(index); if (/[。！？；]/u.test(token.character) || token.character === '\n') flush(); }); flush(); return next;
}
export function applyAll(tokens) { const next = reset(tokens); next.forEach((token,index) => blank(next,index)); return next; }
