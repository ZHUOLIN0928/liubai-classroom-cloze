import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokens } from '../cloze-engine.js';
import { applyAll, applyInterval, applyMiddle, applyRandom, applySentenceEdges, applyWordType } from '../strategy-engine.js';

const marked = (tokens) => tokens.filter((token) => token.blank).map((token) => token.character).join('');

test('interval alternates hidden runs and visible gaps without touching punctuation', () => {
    const tokens = createTokens('甲乙丙丁，戊己');
    assert.equal(marked(applyInterval(tokens,{gap:1,length:2})), '甲乙丁戊');
});
test('even random distribution has an exact target count', () => {
    const tokens = createTokens('甲乙丙丁戊己庚辛壬癸');
    assert.equal(marked(applyRandom(tokens,{ratio:.3,distribution:'even'})).length,3);
});
test('word type uses exact token anchors and preserves the configured share', () => {
    const tokens = createTokens('之甲乙而丙', [{term:'之',start:0,type:'function'},{term:'而',start:3,type:'function'}]);
    assert.equal(marked(applyWordType(tokens,{type:'function',keepRatio:0},() => .9)),'之而');
});
test('sentence edges and middle leave punctuation visible', () => {
    const tokens = createTokens('甲乙丙。丁戊己。');
    assert.equal(marked(applySentenceEdges(tokens,{mode:'end',count:1})),'丙己');
    assert.equal(marked(applyMiddle(tokens)),'乙戊');
    assert.equal(marked(applyAll(tokens)).includes('。'),false);
});
