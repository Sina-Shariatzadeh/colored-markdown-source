'use strict';

const vscode = require('vscode');
const coloredMarkdown = require('./markdownItColored');
const { scan } = require('./scanner');
const { PALETTE } = coloredMarkdown;

/** Editor colors (work on light and dark themes). */
const EDITOR_COLORS = {
  red: '#e5484d', blue: '#2f7de1', green: '#2f9e44', yellow: '#d4a106',
  orange: '#f76b15', purple: '#8e4ec6', pink: '#d6409f', cyan: '#0ea5c6',
  teal: '#12a594', gray: '#8b8d98', grey: '#8b8d98', brown: '#a1662f',
  black: '#1c1c1c', white: '#f5f5f5'
};

const BG_ALPHA = '55';

function toBackground(color) {
  const base = EDITOR_COLORS[color] || color;
  if (color === 'yellow') return '#fff59d99';
  if (/^#[0-9a-f]{6}$/i.test(base)) return base + BG_ALPHA;
  return base;
}

class Decorator {
  constructor() {
    this.highlight = vscode.window.createTextEditorDecorationType({
      backgroundColor: '#fff59d88',
      borderRadius: '2px'
    });
    this.underline = vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline'
    });
    this.markers = vscode.window.createTextEditorDecorationType({
      opacity: '0.45'
    });
    /** @type {Map<string, vscode.TextEditorDecorationType>} */
    this.colorTypes = new Map();
    /** @type {Map<string, vscode.TextEditorDecorationType>} */
    this.bgTypes = new Map();
    this.timer = undefined;
  }

  colorType(color) {
    if (!this.colorTypes.has(color)) {
      this.colorTypes.set(color, vscode.window.createTextEditorDecorationType({
        color: EDITOR_COLORS[color] || color
      }));
    }
    return this.colorTypes.get(color);
  }

  bgType(color) {
    if (!this.bgTypes.has(color)) {
      this.bgTypes.set(color, vscode.window.createTextEditorDecorationType({
        backgroundColor: toBackground(color),
        borderRadius: '3px'
      }));
    }
    return this.bgTypes.get(color);
  }

  enabled() {
    return vscode.workspace.getConfiguration('coloredMarkdown').get('editorDecorations', true);
  }

  schedule(editor) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(editor), 120);
  }

  clear(editor) {
    const all = [this.highlight, this.underline, this.markers, ...this.colorTypes.values(), ...this.bgTypes.values()];
    for (const t of all) editor.setDecorations(t, []);
  }

  update(editor) {
    if (!editor || editor.document.languageId !== 'markdown') return;
    if (!this.enabled()) {
      this.clear(editor);
      return;
    }
    const doc = editor.document;
    const found = scan(doc.getText());
    const toRange = ([s, e]) => new vscode.Range(doc.positionAt(s), doc.positionAt(e));

    editor.setDecorations(this.highlight, found.highlight.map(toRange));
    editor.setDecorations(this.underline, found.underline.map(toRange));
    editor.setDecorations(this.markers, found.markers.map(toRange));

    const group = (items, typeFor, existing) => {
      const byColor = new Map();
      for (const { color, range } of items) {
        if (!byColor.has(color)) byColor.set(color, []);
        byColor.get(color).push(toRange(range));
      }
      for (const color of byColor.keys()) typeFor.call(this, color);
      for (const [color, type] of existing) {
        editor.setDecorations(type, byColor.get(color) || []);
      }
    };
    group(found.color, this.colorType, this.colorTypes);
    group(found.bg, this.bgType, this.bgTypes);
  }

  dispose() {
    clearTimeout(this.timer);
    const all = [this.highlight, this.underline, this.markers, ...this.colorTypes.values(), ...this.bgTypes.values()];
    for (const t of all) t.dispose();
  }
}

/** Wrap every selection in the active editor with `before` / `after`. */
async function wrapSelections(before, after) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  await editor.edit((edit) => {
    for (const sel of editor.selections) {
      const text = editor.document.getText(sel);
      edit.replace(sel, before + text + after);
    }
  });
  // Put the cursor inside the markers when nothing was selected.
  editor.selections = editor.selections.map((sel) => {
    if (!sel.isEmpty) return sel;
    const pos = sel.active.translate(0, -after.length);
    return new vscode.Selection(pos, pos);
  });
}

async function pickColor(placeHolder) {
  const items = PALETTE.filter((c) => c !== 'grey').map((c) => ({ label: c }));
  items.push({ label: '$(edit) Custom…', description: 'hex such as #ff8800 or a CSS color name', custom: true });
  const pick = await vscode.window.showQuickPick(items, { placeHolder });
  if (!pick) return undefined;
  if (!pick.custom) return pick.label;
  const value = await vscode.window.showInputBox({
    prompt: 'Color (hex like #ff8800 or a CSS color name)',
    validateInput: (v) => (coloredMarkdown.sanitizeColor(v) ? undefined : 'Use #rgb, #rrggbb or a color name')
  });
  return value ? { custom: coloredMarkdown.sanitizeColor(value) } : undefined;
}

function activate(context) {
  const decorator = new Decorator();
  context.subscriptions.push(decorator);

  const refreshVisible = () => vscode.window.visibleTextEditors.forEach((e) => decorator.update(e));

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => e && decorator.update(e)),
    vscode.window.onDidChangeVisibleTextEditors(refreshVisible),
    vscode.workspace.onDidChangeTextDocument((ev) => {
      for (const e of vscode.window.visibleTextEditors) {
        if (e.document === ev.document) decorator.schedule(e);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((ev) => {
      if (ev.affectsConfiguration('coloredMarkdown')) refreshVisible();
    }),

    vscode.commands.registerCommand('coloredMarkdown.openPreview', () =>
      vscode.commands.executeCommand('markdown.showPreviewToSide')),
    vscode.commands.registerCommand('coloredMarkdown.highlight', () => wrapSelections('==', '==')),
    vscode.commands.registerCommand('coloredMarkdown.underline', () => wrapSelections('++', '++')),
    vscode.commands.registerCommand('coloredMarkdown.textColor', async (arg) => {
      const color = typeof arg === 'string' ? arg : await pickColor('Text color');
      if (!color) return;
      if (typeof color === 'string') return wrapSelections(`{${color}}`, `{/${color}}`);
      return wrapSelections(`{color:${color.custom}}`, '{/color}');
    }),
    vscode.commands.registerCommand('coloredMarkdown.background', async (arg) => {
      const color = typeof arg === 'string' ? arg : await pickColor('Background color');
      if (!color) return;
      const value = typeof color === 'string' ? color : color.custom;
      return wrapSelections(`{bg:${value}}`, '{/bg}');
    })
  );

  refreshVisible();

  // VS Code calls this to extend its built-in Markdown preview.
  return {
    extendMarkdownIt(md) {
      return md.use(coloredMarkdown);
    }
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
