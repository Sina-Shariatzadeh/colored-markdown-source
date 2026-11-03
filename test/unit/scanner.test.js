'use strict';

const assert = require('assert');
const { scan, maskCode } = require('../../src/scanner');

const slice = (text, [s, e]) => text.slice(s, e);

describe('editor scanner', () => {
  it('finds highlights and their markers', () => {
    const t = 'a ==hi== b';
    const r = scan(t);
    assert.deepStrictEqual(r.highlight.map((x) => slice(t, x)), ['hi']);
    assert.deepStrictEqual(r.markers.map((x) => slice(t, x)), ['==', '==']);
  });
  it('finds underlines but not C++', () => {
    const t = 'C++ and ++u++';
    assert.deepStrictEqual(scan(t).underline.map((x) => slice(t, x)), ['u']);
  });
  it('finds named colors', () => {
    const t = '{red}r{/red} {blue}b{/blue}';
    const r = scan(t);
    assert.deepStrictEqual(r.color.map((c) => [c.color, slice(t, c.range)]), [['red', 'r'], ['blue', 'b']]);
  });
  it('finds custom colors and backgrounds', () => {
    const t = '{color:#ff8800}o{/color} {bg:yellow}y{/bg}';
    const r = scan(t);
    assert.deepStrictEqual(r.color.map((c) => [c.color, slice(t, c.range)]), [['#ff8800', 'o']]);
    assert.deepStrictEqual(r.bg.map((c) => [c.color, slice(t, c.range)]), [['yellow', 'y']]);
    assert.deepStrictEqual(r.markers.map((x) => slice(t, x)), ['{color:#ff8800}', '{/color}', '{bg:yellow}', '{/bg}']);
  });
  it('ignores fenced code and inline code', () => {
    const t = '```\n==x==\n```\n`{red}x{/red}` ==y==';
    const r = scan(t);
    assert.deepStrictEqual(r.highlight.map((x) => slice(t, x)), ['y']);
    assert.strictEqual(r.color.length, 0);
  });
  it('maskCode keeps offsets stable', () => {
    const t = 'a `code` b\n```js\nx\n```\nc';
    assert.strictEqual(maskCode(t).length, t.length);
  });
  it('ignores escaped and padded markers', () => {
    assert.strictEqual(scan('\\==x== and == y ==').highlight.length, 0);
  });
});
