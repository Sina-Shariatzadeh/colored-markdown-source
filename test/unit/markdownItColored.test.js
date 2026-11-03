'use strict';

const assert = require('assert');
const MarkdownIt = require('markdown-it');
const colored = require('../../src/markdownItColored');

const md = new MarkdownIt({ html: false }).use(colored);
const inline = (src) => md.renderInline(src);
const block = (src) => md.render(src);

describe('markdown-it plugin: highlight ==text==', () => {
  it('renders a yellow highlight', () => {
    assert.strictEqual(inline('a ==hi== b'), 'a <mark class="cm-highlight">hi</mark> b');
  });
  it('supports nested inline markdown', () => {
    assert.strictEqual(inline('==**bold** text=='), '<mark class="cm-highlight"><strong>bold</strong> text</mark>');
  });
  it('supports a single character', () => {
    assert.strictEqual(inline('==x=='), '<mark class="cm-highlight">x</mark>');
  });
  it('ignores markers padded by spaces', () => {
    assert.strictEqual(inline('a == b == c'), 'a == b == c');
  });
  it('ignores empty and triple markers', () => {
    assert.strictEqual(inline('====' ), '====');
    assert.strictEqual(inline('===x==='), '===x===');
  });
  it('ignores unclosed markers', () => {
    assert.strictEqual(inline('==open'), '==open');
  });
  it('can be escaped', () => {
    assert.strictEqual(inline('\\==no=='), '==no==');
  });
  it('is not applied inside code', () => {
    assert.strictEqual(inline('`==x==`'), '<code>==x==</code>');
    assert.ok(block('```\n==x==\n```').includes('==x=='));
  });
  it('handles multiple highlights on one line', () => {
    assert.strictEqual(inline('==a== and ==b=='),
      '<mark class="cm-highlight">a</mark> and <mark class="cm-highlight">b</mark>');
  });
});

describe('markdown-it plugin: underline ++text++', () => {
  it('renders an underline', () => {
    assert.strictEqual(inline('++under++'), '<u class="cm-underline">under</u>');
  });
  it('does not break C++', () => {
    assert.strictEqual(inline('I like C++ and C++'), 'I like C++ and C++');
  });
  it('nests with other syntax', () => {
    assert.strictEqual(inline('++==both==++'),
      '<u class="cm-underline"><mark class="cm-highlight">both</mark></u>');
  });
});

describe('markdown-it plugin: text colors', () => {
  it('renders {red}…{/red}', () => {
    assert.strictEqual(inline('{red}text{/red}'), '<span class="cm-color cm-color-red">text</span>');
  });
  it('renders {blue}…{/blue}', () => {
    assert.strictEqual(inline('{blue}text{/blue}'), '<span class="cm-color cm-color-blue">text</span>');
  });
  it('supports every palette color', () => {
    for (const c of colored.PALETTE) {
      assert.strictEqual(inline(`{${c}}x{/${c}}`), `<span class="cm-color cm-color-${c}">x</span>`);
    }
  });
  it('supports nested different colors', () => {
    assert.strictEqual(inline('{red}a {blue}b{/blue} c{/red}'),
      '<span class="cm-color cm-color-red">a <span class="cm-color cm-color-blue">b</span> c</span>');
  });
  it('supports nested same colors', () => {
    assert.strictEqual(inline('{red}a {red}b{/red} c{/red}'),
      '<span class="cm-color cm-color-red">a <span class="cm-color cm-color-red">b</span> c</span>');
  });
  it('supports custom colors via {color:#hex}', () => {
    assert.strictEqual(inline('{color:#ff8800}x{/color}'),
      '<span class="cm-color" style="color: #ff8800">x</span>');
  });
  it('maps {color:red} to the palette class', () => {
    assert.strictEqual(inline('{color:red}x{/color}'), '<span class="cm-color cm-color-red">x</span>');
  });
  it('leaves unknown names and unclosed tags alone', () => {
    assert.strictEqual(inline('{foo}x{/foo}'), '{foo}x{/foo}');
    assert.strictEqual(inline('{red}never closed'), '{red}never closed');
    assert.strictEqual(inline('{red}{/red}'), '{red}{/red}');
  });
  it('rejects CSS injection in custom colors', () => {
    const out = inline('{color:red;background:url(x)}x{/color}');
    assert.ok(!out.includes('<span'), out);
  });
  it('works with inline markdown inside', () => {
    assert.strictEqual(inline('{red}[link](https://x.io){/red}'),
      '<span class="cm-color cm-color-red"><a href="https://x.io">link</a></span>');
  });
});

describe('markdown-it plugin: background colors', () => {
  it('renders {bg:yellow}…{/bg}', () => {
    assert.strictEqual(inline('{bg:yellow}text{/bg}'), '<span class="cm-bg cm-bg-yellow">text</span>');
  });
  it('supports custom hex backgrounds', () => {
    assert.strictEqual(inline('{bg:#ccffcc}x{/bg}'),
      '<span class="cm-bg" style="background-color: #ccffcc">x</span>');
  });
  it('supports nested backgrounds', () => {
    assert.strictEqual(inline('{bg:red}a {bg:blue}b{/bg}{/bg}'),
      '<span class="cm-bg cm-bg-red">a <span class="cm-bg cm-bg-blue">b</span></span>');
  });
  it('combines with text colors', () => {
    assert.strictEqual(inline('{bg:yellow}{red}x{/red}{/bg}'),
      '<span class="cm-bg cm-bg-yellow"><span class="cm-color cm-color-red">x</span></span>');
  });
  it('rejects invalid background values', () => {
    assert.strictEqual(inline('{bg:#12}x{/bg}'), '{bg:#12}x{/bg}');
  });
});

describe('standard Markdown still works', () => {
  it('headings', () => {
    assert.strictEqual(block('# Title ==hi=='), '<h1>Title <mark class="cm-highlight">hi</mark></h1>\n');
  });
  it('lists', () => {
    assert.strictEqual(block('- {red}a{/red}\n- b'),
      '<ul>\n<li><span class="cm-color cm-color-red">a</span></li>\n<li>b</li>\n</ul>\n');
  });
  it('tables', () => {
    const out = block('| a | b |\n|---|---|\n| ==x== | ++y++ |');
    assert.ok(out.includes('<table>'));
    assert.ok(out.includes('<td><mark class="cm-highlight">x</mark></td>'));
    assert.ok(out.includes('<td><u class="cm-underline">y</u></td>'));
  });
  it('code blocks keep raw syntax', () => {
    assert.strictEqual(block('    {red}x{/red}'), '<pre><code>{red}x{/red}\n</code></pre>\n');
  });
  it('links, emphasis and strike', () => {
    assert.strictEqual(inline('[a](https://b.c) *i* **b** ~~s~~'),
      '<a href="https://b.c">a</a> <em>i</em> <strong>b</strong> <s>s</s>');
  });
  it('does not allow raw HTML injection through colored text', () => {
    assert.strictEqual(inline('{red}<script>x</script>{/red}'),
      '<span class="cm-color cm-color-red">&lt;script&gt;x&lt;/script&gt;</span>');
  });
});

describe('sanitizeColor', () => {
  it('accepts hex and names', () => {
    assert.strictEqual(colored.sanitizeColor('#ABC'), '#abc');
    assert.strictEqual(colored.sanitizeColor('#11223344'), '#11223344');
    assert.strictEqual(colored.sanitizeColor('Tomato'), 'tomato');
  });
  it('rejects anything else', () => {
    for (const bad of ['', '#12', 'red;', 'url(x)', 'a b', '#ggg', 'expression(alert(1))']) {
      assert.strictEqual(colored.sanitizeColor(bad), null, bad);
    }
  });
});
