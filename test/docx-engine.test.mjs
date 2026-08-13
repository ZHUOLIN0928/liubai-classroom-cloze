import test from 'node:test';
import assert from 'node:assert/strict';
import { createWordDocument, paragraphTokenGroups, wordTextRuns } from '../docx-engine.js';

test('maps blank tokens to Word-ready blanks without product text', () => {
    const runs=wordTextRuns([{character:'甲',blank:false},{character:'乙',blank:true},{character:'\n',blank:false}], 'underline');
    assert.deepEqual(runs,[{text:'甲',break:undefined},{text:'____',break:undefined},{text:'',break:1}]);
    assert.equal(runs.some((run) => /LNK|16:9/u.test(run.text)),false);
});

test('carries the chosen background and blank result into a local Word document model', () => {
    const previous=globalThis.docx;
    let captured;
    class Document { constructor(options) { captured=options; } }
    class Paragraph { constructor(options) { this.options=options; } }
    class TextRun { constructor(options) { this.options=options; } }
    globalThis.docx={Document,Paragraph,TextRun,AlignmentType:{CENTER:'center'}};
    try {
        createWordDocument([{character:'甲',blank:false},{character:'乙',blank:true}],{title:'默写资料',background:'#f4f5f3',fontFamily:'宋体',fontSize:40});
        assert.equal(captured.background.color,'F4F5F3');
        assert.equal(captured.sections[0].children.length,2);
        const body=captured.sections[0].children[1].options.children.map((run) => run.options.text).join('');
        assert.equal(body,'甲____');
        assert.equal(/LNK|16:9|屏幕/u.test(JSON.stringify(captured)),false);
    } finally {
        if (previous === undefined) delete globalThis.docx;
        else globalThis.docx=previous;
    }
});

test('keeps source newlines as editable Word paragraph boundaries', () => {
    const groups = paragraphTokenGroups([{character:'甲',blank:false},{character:'\n',blank:false},{character:'乙',blank:true}]);
    assert.deepEqual(groups.map((group) => group.map((token) => token.character).join('')), ['甲', '乙']);
});

test('uses paragraph spacing or page breaks to mirror the selected pagination mode', () => {
    const previous=globalThis.docx;
    let captured;
    class Document { constructor(options) { captured=options; } }
    class Paragraph { constructor(options) { this.options=options; } }
    class TextRun { constructor(options) { this.options=options; } }
    globalThis.docx={Document,Paragraph,TextRun,AlignmentType:{CENTER:'center'}};
    try {
        const tokens=[{character:'甲',blank:false},{character:'\n',blank:false},{character:'乙',blank:false}];
        createWordDocument(tokens,{paragraphMode:'newline',fontSize:40});
        const newlineBodies=captured.sections[0].children.slice(1);
        assert.equal(newlineBodies.length,2);
        assert.ok(newlineBodies.every((paragraph) => paragraph.options.spacing.after > 0));
        createWordDocument(tokens,{paragraphMode:'page',fontSize:40});
        const pageBodies=captured.sections[0].children.slice(1);
        assert.equal(pageBodies[0].options.pageBreakBefore,false);
        assert.equal(pageBodies[1].options.pageBreakBefore,true);
    } finally {
        if (previous === undefined) delete globalThis.docx;
        else globalThis.docx=previous;
    }
});
