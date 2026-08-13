import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRule, blankedPlainText, createTokens, isBlankable, isPunctuation, toggleRange } from '../cloze-engine.js';

test('creates real and function-word anchors over every matching occurrence', () => {
    const tokens = createTokens('学而时习之，而不亦说乎？', [{ term: '而', type: 'function' }, { term: '习', type: 'content' }]);
    assert.equal(tokens.filter((token) => token.type === 'function').length, 2);
    assert.equal(tokens.find((token) => token.character === '习').type, 'content');
});

test('uses an exported anchor position instead of blanking homographs elsewhere in the text', () => {
    const tokens = createTokens('而学而思', [{ term: '而', start: 2, type: 'function' }]);
    const result = applyRule(tokens, 'function');
    assert.equal(blankedPlainText(result), '而学＿思');
});

test('random rule blanks a deterministic share without punctuation', () => {
    const tokens = createTokens('甲乙丙。');
    const result = applyRule(tokens, 'random', { ratio: 2 / 3 }, () => 0.2);
    assert.equal(result.filter((token) => token.blank).length, 2);
    assert.equal(result.at(-1).blank, false);
});

test('sentence start and end rules respect sentence boundaries', () => {
    const tokens = createTokens('甲乙。丙丁！');
    assert.equal(blankedPlainText(applyRule(tokens, 'sentence-start', { count: 1 })), '＿乙。＿丁！');
    assert.equal(blankedPlainText(applyRule(tokens, 'sentence-end', { count: 1 })), '甲＿。丙＿！');
});

test('manual range can force a contiguous path on or off', () => {
    const tokens = createTokens('甲乙丙丁');
    const blanked = toggleRange(tokens, 1, 3, true);
    assert.equal(blankedPlainText(blanked), '甲＿＿＿');
    assert.equal(blankedPlainText(toggleRange(blanked, 2, 3, false)), '甲＿丙丁');
});

test('preserves Unicode punctuation while allowing a manual range to cross it', () => {
    const tokens = createTokens('甲「乙」……丙——丁《戊》！');
    const punctuation = tokens.filter(isPunctuation);
    assert.ok(punctuation.length >= 8);
    assert.ok(punctuation.every((token) => !isBlankable(token)));
    const result = toggleRange(tokens, 0, tokens.length - 1, true);
    assert.equal(blankedPlainText(result), '＿「＿」……＿——＿《＿》！');
});
