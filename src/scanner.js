'use strict';

/**
 * Finds Colored Markdown syntax in raw document text so the editor can
 * color it as you type. Pure function, no VS Code dependency, so it is
 * unit-tested directly.
 */

const { PALETTE, sanitizeColor } = require('./markdownItColored');

const PALETTE_ALT = PALETTE.join('|');

/** Replace fenced code blocks and inline code spans with spaces (same length). */
function maskCode(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  // Fenced code blocks, line by line.
  const lines = text.split('\n');
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && /^ {0,3}[`~]+[ \t]*$/.test(lines[i])) {
        fence = null;
      }
      lines[i] = blank(lines[i]);
    } else if (m) {
      fence = m[1];
      lines[i] = blank(lines[i]);
    }
  }
  // Inline code spans.
  return lines.join('\n').replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, blank);
}

/**
 * @returns {{
 *   highlight: Array<[number, number]>,
 *   underline: Array<[number, number]>,
 *   color: Array<{ color: string, range: [number, number] }>,
 *   bg: Array<{ color: string, range: [number, number] }>,
 *   markers: Array<[number, number]>
 * }} offsets into `text` (start inclusive, end exclusive)
 */
function scan(text) {
  const src = maskCode(text);
  const result = { highlight: [], underline: [], color: [], bg: [], markers: [] };

  const symmetric = (re, bucket) => {
    for (const m of src.matchAll(re)) {
      if (m.index > 0 && src[m.index - 1] === '\\') continue;
      const start = m.index;
      const end = start + m[0].length;
      result[bucket].push([start + 2, end - 2]);
      result.markers.push([start, start + 2], [end - 2, end]);
    }
  };
  symmetric(/(?<![=])==(?=[^\s=])[^\n]*?[^\s=]==(?!=)|(?<![=])==[^\s=]==(?!=)/g, 'highlight');
  symmetric(/(?<![+])\+\+(?=[^\s+])[^\n]*?[^\s+]\+\+(?!\+)|(?<![+])\+\+[^\s+]\+\+(?!\+)/g, 'underline');

  const named = new RegExp(`\\{(${PALETTE_ALT})\\}([\\s\\S]*?)\\{\\/\\1\\}`, 'g');
  for (const m of src.matchAll(named)) {
    const openLen = m[1].length + 2;
    const start = m.index;
    const end = start + m[0].length;
    const closeLen = m[1].length + 3;
    if (end - closeLen <= start + openLen) continue;
    result.color.push({ color: m[1].toLowerCase(), range: [start + openLen, end - closeLen] });
    result.markers.push([start, start + openLen], [end - closeLen, end]);
  }

  const keyed = /\{(color|bg):\s*([#a-z0-9]+)\s*\}([\s\S]*?)\{\/\1\}/gi;
  for (const m of src.matchAll(keyed)) {
    const color = sanitizeColor(m[2]);
    if (!color) continue;
    const kind = m[1].toLowerCase();
    const openLen = m[0].length - m[3].length - (m[1].length + 3);
    const closeLen = m[1].length + 3;
    const start = m.index;
    const end = start + m[0].length;
    if (end - closeLen <= start + openLen) continue;
    result[kind === 'bg' ? 'bg' : 'color'].push({ color, range: [start + openLen, end - closeLen] });
    result.markers.push([start, start + openLen], [end - closeLen, end]);
  }

  return result;
}

module.exports = { scan, maskCode };
