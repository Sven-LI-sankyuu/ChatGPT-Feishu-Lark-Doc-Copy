/**
 * 转换器的结构化样本测试。
 *
 * 使用一条同时包含标题、排版、公式、列表、引用、代码、表格和链接的回复，检查最终
 * Markdown 是否保留语义，并确认转换过程不会修改页面中的原始回复。
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const converterSource = await readFile(new URL("../src/converter.js", import.meta.url), "utf8");

function createConverter(html) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://chatgpt.com/c/example"
  });
  dom.window.eval(converterSource);
  return {
    dom,
    converter: dom.window.ChatGPTFeishuCopyConverter,
    root: dom.window.document.querySelector(".markdown")
  };
}

test("保留复杂回复的结构并生成飞书 Markdown", () => {
  const { converter, root } = createConverter(`
    <main class="markdown" onclick="unsafe()">
      <h2 data-start="1">方法概览</h2>
      <p>损失为 <span class="katex"><math><semantics><annotation encoding="application/x-tex">L(\\theta)</annotation></semantics></math></span>，参见 <a href="/research" target="_blank">研究说明</a>。</p>
      <div class="katex-display"><span class="katex"><math><semantics><annotation encoding="application/x-tex">\\sum_{i=1}^{n} i</annotation></semantics></math></span></div>
      <h3>步骤</h3>
      <ol start="2"><li><strong>准备</strong>数据</li><li>运行<ul><li>检查结果</li></ul></li></ol>
      <blockquote><p>保留原始证据。</p></blockquote>
      <pre><code class="language-python">print("ok")</code><button>Copy code</button></pre>
      <table><thead><tr><th>方法</th><th>公式</th></tr></thead><tbody><tr><td>基线</td><td><span class="katex" data-latex="x^2">x²</span></td></tr></tbody></table>
      <p><em>注意</em> <del>旧值</del> <a href="javascript:alert(1)">危险链接</a></p>
      <script>window.stolen = true</script>
    </main>
  `);

  const result = converter.convertDomToClipboard(root);

  assert.match(result.text, /^## 方法概览/m);
  assert.match(result.text, /损失为 \$L\(\\theta\)\$/);
  assert.match(result.text, /\[研究说明\]\(https:\/\/chatgpt\.com\/research\)/);
  assert.match(result.text, /\$\$\n\\sum_\{i=1\}\^\{n\} i\n\$\$/);
  assert.match(result.text, /^### 步骤/m);
  assert.match(result.text, /^2\. \*\*准备\*\*数据/m);
  assert.match(result.text, /^  - 检查结果/m);
  assert.match(result.text, /^> 保留原始证据。/m);
  assert.match(result.text, /```python\nprint\("ok"\)\n```/);
  assert.match(result.text, /\| 方法 \| 公式 \|\n\| --- \| --- \|\n\| 基线 \| \$x\^2\$ \|/);
  assert.match(result.text, /\*注意\* ~~旧值~~ 危险链接/);

  assert.equal(root.querySelectorAll(".katex").length, 3, "原始回复不应被转换器修改");
});

test("转换文本中的原始 LaTeX 定界符", () => {
  const { converter, root } = createConverter(`
    <div class="markdown"><p>行内 \\(a+b\\)</p><p>块级 \\[c=d\\]</p><pre><code>\\(code\\)</code></pre></div>
  `);
  const result = converter.convertDomToClipboard(root);

  assert.match(result.text, /行内 \$a\+b\$/);
  assert.match(result.text, /块级 \$\$\nc=d\n\$\$/);
  assert.match(result.text, /```\n\\\(code\\\)\n```/);
});

test("保留相邻和嵌套的强调与删除线", () => {
  const { converter, root } = createConverter(`
    <div class="markdown">
      <p><strong>粗体</strong>、<em>斜体</em>、<strong><em>粗斜体</em></strong>、<del>删除线</del></p>
      <p><b>粗体别名</b>、<i>斜体别名</i>、<s>删除线别名</s></p>
    </div>
  `);

  const result = converter.convertDomToClipboard(root);

  assert.match(result.text, /^\*\*粗体\*\*、\*斜体\*、\*\*\*粗斜体\*\*\*、~~删除线~~$/m);
  assert.match(result.text, /^\*\*粗体别名\*\*、\*斜体别名\*、~~删除线别名~~$/m);
});

test("移除块之间的空白行并保留代码块内部空行", () => {
  const { converter, root } = createConverter(`
    <div class="markdown">
      <h2>紧凑排版</h2>
      <p>第一段</p>
      <p>第二段</p>
      <div class="katex-display"><span class="katex"><math><semantics><annotation encoding="application/x-tex">a+b=c

x+y=z</annotation></semantics></math></span></div>
      <pre><code>第一行

第三行</code></pre>
    </div>
  `);

  const result = converter.convertDomToClipboard(root);

  assert.equal(result.text, [
    "## 紧凑排版",
    "第一段",
    "第二段",
    "$$",
    "a+b=c",
    "",
    "x+y=z",
    "$$",
    "```",
    "第一行",
    "",
    "第三行",
    "```"
  ].join("\n"));
});

test("空内容正确失败", () => {
  const { converter, root } = createConverter('<div class="markdown"><button>复制</button></div>');
  assert.throws(() => converter.convertDomToClipboard(root), /转换后为空/);
});
