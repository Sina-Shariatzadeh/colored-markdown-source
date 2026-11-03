'use strict';

// Runs src/extension.js against a small fake `vscode` module, so activation,
// commands and editor decorations are covered without launching VS Code.
// The real-VS-Code checks live in test/integration.

const assert = require('assert');
const Module = require('module');
const MarkdownIt = require('markdown-it');

function createFakeVscode() {
  const commands = new Map();
  const listeners = {};
  const on = (name) => (fn) => {
    (listeners[name] ||= []).push(fn);
    return { dispose() {} };
  };
  class Position { constructor(line, character) { this.line = line; this.character = character; } }
  class Range { constructor(start, end) { this.start = start; this.end = end; } }
  class Selection extends Range {
    constructor(anchor, active) { super(anchor, active); this.anchor = anchor; this.active = active; }
    get isEmpty() { return this.anchor.offset === this.active.offset; }
  }

  // A one-line document is enough for these tests: positions are plain offsets.
  function makeEditor(text) {
    const document = {
      languageId: 'markdown',
      text,
      getText(range) { return range ? this.text.slice(range.start.offset, range.end.offset) : this.text; },
      positionAt(offset) { return Object.assign(new Position(0, offset), { offset }); }
    };
    const decorations = new Map();
    const pos = (o) => document.positionAt(o);
    const editor = {
      document,
      decorations,
      selections: [],
      select(a, b) {
        const s = new Selection(pos(a), pos(b));
        this.selections = [s];
      },
      setDecorations(type, ranges) { decorations.set(type, ranges); },
      async edit(cb) {
        const edits = [];
        cb({ replace: (sel, value) => edits.push({ sel, value }) });
        edits.sort((x, y) => y.sel.start.offset - x.sel.start.offset);
        for (const { sel, value } of edits) {
          document.text = document.text.slice(0, sel.start.offset) + value + document.text.slice(sel.end.offset);
          const end = pos(sel.start.offset + value.length);
          sel.active = end;
          sel.anchor = sel.isEmpty ? end : sel.anchor;
        }
        return true;
      }
    };
    // Selections in the fake need `translate` to place the cursor.
    Position.prototype.translate = function (_l, d) { return pos(this.offset + d); };
    return editor;
  }

  const config = { editorDecorations: true };
  const vscode = {
    Position, Range, Selection,
    window: {
      activeTextEditor: undefined,
      visibleTextEditors: [],
      createTextEditorDecorationType: (opts) => ({ opts, dispose() {} }),
      onDidChangeActiveTextEditor: on('active'),
      onDidChangeVisibleTextEditors: on('visible'),
      showQuickPick: async () => undefined,
      showInputBox: async () => undefined
    },
    workspace: {
      getConfiguration: () => ({ get: (k, d) => (k in config ? config[k] : d) }),
      onDidChangeTextDocument: on('change'),
      onDidChangeConfiguration: on('config')
    },
    commands: {
      registerCommand(id, fn) { commands.set(id, fn); return { dispose() {} }; },
      executeCommand(id, ...args) {
        if (commands.has(id)) return commands.get(id)(...args);
        vscode.executed.push(id);
        return Promise.resolve();
      }
    },
    executed: [],
    _fire: (name, arg) => (listeners[name] || []).forEach((fn) => fn(arg)),
    _commands: commands,
    _config: config,
    _makeEditor: makeEditor
  };
  return vscode;
}

describe('extension (with a fake vscode API)', () => {
  let vscode;
  let ext;
  let api;
  const origResolve = Module._resolveFilename;

  before(() => {
    vscode = createFakeVscode();
    Module._resolveFilename = function (request, ...rest) {
      if (request === 'vscode') return 'vscode';
      return origResolve.call(this, request, ...rest);
    };
    require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: vscode };
    delete require.cache[require.resolve('../../src/extension')];
    ext = require('../../src/extension');
    api = ext.activate({ subscriptions: [] });
  });

  after(() => {
    Module._resolveFilename = origResolve;
    delete require.cache.vscode;
  });

  it('returns extendMarkdownIt for the built-in preview', () => {
    const html = api.extendMarkdownIt(new MarkdownIt()).render('==a== ++b++ {red}c{/red} {bg:yellow}d{/bg}');
    assert.ok(html.includes('<mark class="cm-highlight">a</mark>'));
    assert.ok(html.includes('<u class="cm-underline">b</u>'));
    assert.ok(html.includes('cm-color-red'));
    assert.ok(html.includes('cm-bg-yellow'));
  });

  it('registers every contributed command', () => {
    const contributed = require('../../package.json').contributes.commands.map((c) => c.command);
    for (const id of contributed) assert.ok(vscode._commands.has(id), id);
  });

  const wrap = async (text, from, to, command, ...args) => {
    const editor = vscode._makeEditor(text);
    editor.select(from, to);
    vscode.window.activeTextEditor = editor;
    await vscode.commands.executeCommand(command, ...args);
    return editor.document.text;
  };

  it('wraps a selection with highlight and underline', async () => {
    assert.strictEqual(await wrap('hello world', 6, 11, 'coloredMarkdown.highlight'), 'hello ==world==');
    assert.strictEqual(await wrap('hello', 0, 5, 'coloredMarkdown.underline'), '++hello++');
  });

  it('wraps with text and background colors', async () => {
    assert.strictEqual(await wrap('hi', 0, 2, 'coloredMarkdown.textColor', 'red'), '{red}hi{/red}');
    assert.strictEqual(await wrap('hi', 0, 2, 'coloredMarkdown.background', 'yellow'), '{bg:yellow}hi{/bg}');
  });

  it('uses the picker result, including custom colors', async () => {
    vscode.window.showQuickPick = async () => ({ label: 'custom', custom: true });
    vscode.window.showInputBox = async () => '#FF8800';
    assert.strictEqual(await wrap('x', 0, 1, 'coloredMarkdown.textColor'), '{color:#ff8800}x{/color}');
    vscode.window.showQuickPick = async () => ({ label: 'blue' });
    assert.strictEqual(await wrap('x', 0, 1, 'coloredMarkdown.background'), '{bg:blue}x{/bg}');
  });

  it('does nothing when the picker is cancelled', async () => {
    vscode.window.showQuickPick = async () => undefined;
    assert.strictEqual(await wrap('x', 0, 1, 'coloredMarkdown.textColor'), 'x');
  });

  it('forwards Open Live Preview to the built-in preview command', async () => {
    await vscode.commands.executeCommand('coloredMarkdown.openPreview');
    assert.ok(vscode.executed.includes('markdown.showPreviewToSide'));
  });

  it('decorates visible editors and clears when the setting is off', () => {
    const editor = vscode._makeEditor('==a== {red}b{/red}');
    vscode.window.visibleTextEditors = [editor];
    vscode._fire('visible', [editor]);
    const active = () => [...editor.decorations.values()].filter((r) => r.length > 0).length;
    assert.ok(active() >= 3, 'highlight, color and marker decorations expected');

    vscode._config.editorDecorations = false;
    vscode._fire('config', { affectsConfiguration: (k) => k === 'coloredMarkdown' });
    assert.strictEqual(active(), 0);

    vscode._config.editorDecorations = true;
    vscode._fire('config', { affectsConfiguration: (k) => k === 'coloredMarkdown' });
    assert.ok(active() >= 3);
  });

  it('re-decorates shortly after the user types', async () => {
    const editor = vscode._makeEditor('plain');
    vscode.window.visibleTextEditors = [editor];
    vscode._fire('visible', [editor]);
    editor.document.text = '++typed++';
    vscode._fire('change', { document: editor.document });
    await new Promise((r) => setTimeout(r, 200));
    const ranges = [...editor.decorations.values()].flat();
    assert.ok(ranges.some((r) => r.start.offset === 2 && r.end.offset === 7), 'underline range expected');
  });
});
