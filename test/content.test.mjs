/**
 * 内容脚本的交互边界测试。
 *
 * 模拟两轮长对话和 ChatGPT 原生复制按钮，验证按钮一对一注入、完整回复复制、重复扫描去重，
 * 以及官方复制流程不受插件影响。
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const converterSource = await readFile(new URL("../src/converter.js", import.meta.url), "utf8");
const contentSource = await readFile(new URL("../src/content.js", import.meta.url), "utf8");

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("每条助手回复获得独立按钮并复制所属完整内容", async () => {
  const dom = new JSDOM(`
    <article data-testid="conversation-turn-2">
      <div data-message-author-role="assistant"><div class="markdown" style="height:2000px"><h2>第一条</h2><p>可视区域开头</p><p>回复末尾标记 FIRST_TAIL</p></div></div>
      <div class="actions"><button data-testid="copy-turn-action-button" aria-label="Copy" style="color: rgb(90, 90, 90); opacity: 0.66"><svg style="color: rgb(80, 80, 80); opacity: 0.8"></svg></button></div>
    </article>
    <article data-testid="conversation-turn-4">
      <div data-message-author-role="assistant"><div class="markdown"><h2>第二条</h2><p>回复末尾标记 SECOND_TAIL</p></div></div>
      <div class="actions"><button data-testid="copy-turn-action-button" aria-label="Copy">原生复制</button></div>
    </article>
  `, {
    runScripts: "outside-only",
    url: "https://chatgpt.com/c/example"
  });

  const clipboardWrites = [];
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text) => clipboardWrites.push(text) }
  });
  dom.window.eval(converterSource);
  dom.window.eval(contentSource);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  await nextTask();

  const buttons = dom.window.document.querySelectorAll("[data-feishu-copy-button]");
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].getAttribute("aria-label"), "复制飞书文档版");
  assert.equal(buttons[0].previousElementSibling.getAttribute("data-testid"), "copy-turn-action-button");
  assert.equal(buttons[0].style.getPropertyValue("--feishu-copy-official-color"), "rgb(80, 80, 80)");
  assert.equal(buttons[0].style.getPropertyValue("--feishu-copy-official-opacity"), "0.528");
  assert.equal(buttons[1].previousElementSibling.getAttribute("data-testid"), "copy-turn-action-button");

  buttons[0].dispatchEvent(new dom.window.MouseEvent("mouseenter"));
  const tooltip = dom.window.document.querySelector("[data-feishu-copy-tooltip]");
  assert.equal(tooltip.textContent, "复制飞书文档版");
  assert.equal(tooltip.hasAttribute("data-visible"), true);
  assert.equal(tooltip.style.top, "7px", "提示层应定位在按钮下方");

  let officialClicks = 0;
  const officialButton = dom.window.document.querySelector('button[data-testid="copy-turn-action-button"]');
  officialButton.addEventListener("click", () => { officialClicks += 1; });
  officialButton.click();
  await nextTask();
  assert.equal(officialClicks, 1);
  assert.equal(clipboardWrites.length, 0, "官方按钮不应触发插件剪贴板写入");

  buttons[0].click();
  await nextTask();
  assert.equal(clipboardWrites.length, 1);
  assert.equal(buttons[0].getAttribute("aria-label"), "已复制飞书文档版, 去粘贴吧~");
  assert.equal(tooltip.textContent, "已复制飞书文档版, 去粘贴吧~");
  const firstPlainText = clipboardWrites[0];
  assert.match(firstPlainText, /第一条/);
  assert.match(firstPlainText, /FIRST_TAIL/, "屏幕外的回复末尾也应被完整复制");
  assert.doesNotMatch(firstPlainText, /SECOND_TAIL/, "按钮不得跨越到下一条助手回复");

  dom.window.document.body.append(dom.window.document.createElement("span"));
  await nextTask();
  assert.equal(dom.window.document.querySelectorAll("[data-feishu-copy-button]").length, 2, "重复扫描不得添加重复按钮");
});

test("内容脚本不拦截全局复制或重写原生剪贴板方法", () => {
  assert.doesNotMatch(contentSource, /addEventListener\(["']copy["']/);
  assert.doesNotMatch(contentSource, /navigator\.clipboard\.(write|writeText)\s*=/);
  assert.doesNotMatch(contentSource, /stopImmediatePropagation/);
});
