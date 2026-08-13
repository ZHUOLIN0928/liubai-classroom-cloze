import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPage, paginateTokens, ratioSpec } from '../export-engine.js';

const source = (text) => Array.from(text).map((character, index) => ({ character, index, blank: false }));

test('paginates a long source without losing or duplicating visible characters', () => {
    const text = '岳阳楼记。'.repeat(400);
    const layout = paginateTokens(source(text), { spec: { width: 600, height: 440 }, fontSize: 40, lineHeight: 1.7, margin: 42 });
    assert.ok(layout.pages.length > 2);
    assert.equal(layout.pages.flatMap((page) => page.items).map((item) => item.character).join(''), text);
});

test('moves a line to the next page before it crosses the footer-safe area', () => {
    const layout = paginateTokens(source('甲'.repeat(600)), { spec: { width: 520, height: 380 }, fontSize: 38, lineHeight: 1.7, margin: 36 });
    for (const page of layout.pages) {
        const placed = page.items.filter((item) => !item.newline);
        assert.ok(placed.every((item) => item.y + layout.fontSize * .35 <= page.height - layout.margin - layout.footerHeight));
    }
});

test('accepts a custom portrait ratio for pagination', () => {
    const spec = ratioSpec('3:5');
    assert.equal(spec.width / spec.height, .6);
    assert.ok(paginateTokens(source('甲乙丙'), { spec }).pages.length === 1);
});

test('keeps a fitting paragraph together and leaves spacing before the next paragraph', () => {
    const tokens = source('甲'.repeat(18) + '\n' + '乙'.repeat(18));
    const layout = paginateTokens(tokens, { spec:{width:360,height:420},fontSize:34,lineHeight:1.45,margin:32,paragraphMode:'newline' });
    assert.equal(layout.pages.length, 2);
    assert.deepEqual(layout.pages.map((page) => page.paragraphIds), [[0], [1]]);
    assert.equal(layout.pages.flatMap((page) => page.items).map((item) => item.character).join(''), tokens.map((token) => token.character).join(''));
});

test('starts every paragraph on its own page when the one-paragraph-per-page mode is selected', () => {
    const tokens = source('甲乙丙\n丁戊己\n庚辛壬');
    const layout = paginateTokens(tokens, { spec:{width:600,height:520},fontSize:36,lineHeight:1.5,margin:40,paragraphMode:'page' });
    assert.equal(layout.pages.length, 3);
    assert.deepEqual(layout.pages.map((page) => page.paragraphIds), [[0], [1], [2]]);
});

test('lets an overlong single paragraph continue without mixing another paragraph onto its pages', () => {
    const tokens = source('甲'.repeat(160) + '\n乙');
    const layout = paginateTokens(tokens, { spec:{width:320,height:350},fontSize:34,lineHeight:1.4,margin:32,paragraphMode:'page' });
    const paragraphPages = layout.pages.map((page) => page.paragraphIds);
    assert.ok(paragraphPages.slice(0, -1).every((ids) => ids.every((id) => id === 0)));
    assert.deepEqual(paragraphPages.at(-1), [1]);
});

test('draws a clean worksheet without product or ratio watermark text', () => {
    const calls=[];
    const context={scale(){},fillRect(){},fillText(text){calls.push(String(text));},beginPath(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){},set fillStyle(value){},set strokeStyle(value){},set lineWidth(value){},set textAlign(value){},set font(value){calls.push(value);}};
    const canvas={getContext:() => context};
    const layout=paginateTokens(source('甲乙丙'), { spec:{width:600,height:420},fontSize:38,lineHeight:1.7,margin:36 });
    drawPage(canvas,layout.pages[0],{title:'默写练习',meta:'诸葛亮 · 蜀汉',fontFamily:'"TeacherFont", serif',fontSize:38,pageCount:1,formatLabel:'16:9'});
    assert.equal(calls.some((value) => /LNK LUMEN|16:9|屏幕|投影/u.test(value)),false);
    assert.equal(calls.some((value) => value.includes('TeacherFont')),true);
});
