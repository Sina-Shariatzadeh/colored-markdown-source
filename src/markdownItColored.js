'use strict';

/**
 * markdown-it plugin that adds:
 *
 *   ==text==               -> <mark>           (yellow highlight)
 *   ++text++               -> <u>              (underline)
 *   {red}text{/red}        -> red text         (any color in PALETTE)
 *   {color:#ff8800}t{/color} -> any hex / named color
 *   {bg:yellow}text{/bg}   -> colored background
 *
 * The plugin has no runtime dependencies; VS Code hands it the markdown-it
 * instance used by the built-in Markdown preview.
 */

const PALETTE = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple',
  'pink', 'cyan', 'teal', 'gray', 'grey', 'brown', 'black', 'white'
];

const PALETTE_SET = new Set(PALETTE);
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NAMED_RE = /^[a-z]{3,20}$/i;

/** Returns a safe CSS color value, or null when the value is not allowed. */
function sanitizeColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (HEX_RE.test(v)) return v.toLowerCase();
  if (NAMED_RE.test(v)) return v.toLowerCase();
  return null;
}

const isSpace = (code) => code === 0x20 || code === 0x09 || code === 0x0a;

/**
 * Parse `src[start..end)` as inline markdown, wrapped in open/close tokens.
 */
function wrapInline(state, contentStart, contentEnd, afterClose, tag, attrs, markup) {
  const oldMax = state.posMax;

  const open = state.push(`colored_${tag}_open`, tag, 1);
  open.markup = markup;
  for (const [k, v] of attrs) open.attrSet(k, v);

  state.pos = contentStart;
  state.posMax = contentEnd;
  state.md.inline.tokenize(state);

  const close = state.push(`colored_${tag}_close`, tag, -1);
  close.markup = markup;

  state.pos = afterClose;
  state.posMax = oldMax;
}

/**
 * Rule factory for symmetric two-char markers such as `==` and `++`.
 */
function symmetricRule(markerChar, tag, className) {
  const code = markerChar.charCodeAt(0);
  const marker = markerChar + markerChar;

  return function (state, silent) {
    const src = state.src;
    const start = state.pos;
    const max = state.posMax;

    if (src.charCodeAt(start) !== code || src.charCodeAt(start + 1) !== code) return false;
    // Reject runs of three or more marker chars (e.g. `===` or `+++`).
    if (src.charCodeAt(start + 2) === code) return false;
    if (start > 0 && src.charCodeAt(start - 1) === code) return false;

    const contentStart = start + 2;
    if (contentStart >= max || isSpace(src.charCodeAt(contentStart))) return false;

    let search = contentStart;
    let close = -1;
    while (search < max) {
      const idx = src.indexOf(marker, search);
      if (idx < 0 || idx + 2 > max) break;
      if (!isSpace(src.charCodeAt(idx - 1)) && src.charCodeAt(idx + 2) !== code) {
        close = idx;
        break;
      }
      search = idx + 1;
    }
    if (close < 0 || close === contentStart) return false;

    if (!silent) {
      wrapInline(state, contentStart, close, close + 2, tag, [['class', className]], marker);
    }
    state.pos = close + 2;
    return true;
  };
}

const OPEN_TAG_RE = /^\{(?:(bg|color):\s*([#a-z0-9]+)\s*|([a-z]+))\}/i;

/**
 * Find the matching close tag, honouring nesting of the same tag kind.
 * `kind` is the closing name: a palette color, `color` or `bg`.
 */
function findClose(src, from, max, kind) {
  const closeTag = `{/${kind}}`;
  const openPrefix = kind === 'bg' || kind === 'color' ? `{${kind}:` : `{${kind}}`;
  let depth = 1;
  let i = from;
  while (i < max) {
    const nextClose = src.indexOf(closeTag, i);
    if (nextClose < 0 || nextClose + closeTag.length > max) return -1;
    const nextOpen = src.indexOf(openPrefix, i);
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + openPrefix.length;
      continue;
    }
    depth--;
    if (depth === 0) return nextClose;
    i = nextClose + closeTag.length;
  }
  return -1;
}

function braceRule(state, silent) {
  const src = state.src;
  const start = state.pos;
  const max = state.posMax;
  if (src.charCodeAt(start) !== 0x7b /* { */) return false;

  const m = OPEN_TAG_RE.exec(src.slice(start, Math.min(max, start + 40)));
  if (!m) return false;

  let kind;
  let attrs;
  if (m[3]) {
    const name = m[3].toLowerCase();
    if (!PALETTE_SET.has(name)) return false;
    kind = m[3]; // keep the author's casing for the close tag search
    attrs = [['class', `cm-color cm-color-${name}`]];
  } else {
    const which = m[1].toLowerCase();
    const color = sanitizeColor(m[2]);
    if (!color) return false;
    kind = m[1];
    if (which === 'bg') {
      attrs = PALETTE_SET.has(color)
        ? [['class', `cm-bg cm-bg-${color}`]]
        : [['class', 'cm-bg'], ['style', `background-color: ${color}`]];
    } else {
      attrs = PALETTE_SET.has(color)
        ? [['class', `cm-color cm-color-${color}`]]
        : [['class', 'cm-color'], ['style', `color: ${color}`]];
    }
  }

  const contentStart = start + m[0].length;
  const close = findClose(src, contentStart, max, kind);
  if (close < 0 || close === contentStart) return false;

  if (!silent) {
    wrapInline(state, contentStart, close, close + kind.length + 3, 'span', attrs, m[0]);
  }
  state.pos = close + kind.length + 3;
  return true;
}

function coloredMarkdown(md) {
  md.inline.ruler.before('emphasis', 'colored_mark', symmetricRule('=', 'mark', 'cm-highlight'));
  md.inline.ruler.before('emphasis', 'colored_underline', symmetricRule('+', 'u', 'cm-underline'));
  md.inline.ruler.before('emphasis', 'colored_brace', braceRule);
  return md;
}

module.exports = coloredMarkdown;
module.exports.default = coloredMarkdown;
module.exports.PALETTE = PALETTE;
module.exports.sanitizeColor = sanitizeColor;
