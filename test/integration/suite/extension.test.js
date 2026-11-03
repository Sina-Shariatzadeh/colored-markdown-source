'use strict';

const assert = require('assert');
const path = require('path');
const vscode = require('vscode');
const MarkdownIt = require('markdown-it');

const EXT_ID = require('../../../package.json').publisher + '.colored-markdown';
const sample = path.resolve(__dirname, '../../fixtures/sample.md');

async function openSample() {
  const doc = await vscode.workspace.openTextDocument(sample);
  return vscode.window.showTextDocument(doc);
}

async function newMarkdown(content) {
  const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content });
  return vscode.window.showTextDocument(doc);
}

describe('Colored Markdown (in VS Code)', () => {
  it('activates on a Markdown file and exposes extendMarkdownIt', async () => {
    await openSample();
    const ext = vscode.extensions.getExtension(EXT_ID);
    assert.ok(ext, `extension ${EXT_ID} not found`);
    const api = await ext.activate();
    assert.strictEqual(typeof api.extendMarkdownIt, 'function');
    const html = api.extendMarkdownIt(new MarkdownIt()).render('==a== {red}b{/red} {bg:yellow}c{/bg} ++d++');
    assert.ok(html.includes('<mark class="cm-highlight">a</mark>'), html);
    assert.ok(html.includes('<span class="cm-color cm-color-red">b</span>'), html);
    assert.ok(html.includes('<span class="cm-bg cm-bg-yellow">c</span>'), html);
    assert.ok(html.includes('<u class="cm-underline">d</u>'), html);
  });

  it('registers all commands', async () => {
    const cmds = await vscode.commands.getCommands(true);
    for (const c of ['openPreview', 'highlight', 'underline', 'textColor', 'background']) {
      assert.ok(cmds.includes(`coloredMarkdown.${c}`), c);
    }
  });

  it('highlight command wraps the selection', async () => {
    const editor = await newMarkdown('hello world');
    editor.selection = new vscode.Selection(0, 6, 0, 11);
    await vscode.commands.executeCommand('coloredMarkdown.highlight');
    assert.strictEqual(editor.document.getText(), 'hello ==world==');
  });

  it('underline command wraps the selection', async () => {
    const editor = await newMarkdown('hello');
    editor.selection = new vscode.Selection(0, 0, 0, 5);
    await vscode.commands.executeCommand('coloredMarkdown.underline');
    assert.strictEqual(editor.document.getText(), '++hello++');
  });

  it('text color and background commands accept a color argument', async () => {
    const editor = await newMarkdown('hi');
    editor.selection = new vscode.Selection(0, 0, 0, 2);
    await vscode.commands.executeCommand('coloredMarkdown.textColor', 'red');
    assert.strictEqual(editor.document.getText(), '{red}hi{/red}');
    editor.selection = new vscode.Selection(0, 0, 0, editor.document.getText().length);
    await vscode.commands.executeCommand('coloredMarkdown.background', 'yellow');
    assert.strictEqual(editor.document.getText(), '{bg:yellow}{red}hi{/red}{/bg}');
  });

  it('opens the live preview to the side', async () => {
    await openSample();
    await vscode.commands.executeCommand('coloredMarkdown.openPreview');
    await new Promise((r) => setTimeout(r, 1500));
    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    assert.ok(tabs.some((t) => /preview/i.test(t.label)), tabs.map((t) => t.label).join(', '));
  });
});
