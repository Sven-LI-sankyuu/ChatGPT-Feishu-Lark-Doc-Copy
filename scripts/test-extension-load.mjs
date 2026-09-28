/**
 * 在真实 Chromium 扩展环境中验证构建产物。
 *
 * 测试浏览器加载 dist/unpacked，并在 chatgpt.com 域名下拦截固定回复页面；随后检查
 * Manifest V3 内容脚本是否注入按钮、按钮是否紧邻官方复制按钮，且公式、列表、表格和错误
 * 状态在真实剪贴板路径中都能按预期工作。测试不访问用户账号。
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = resolve(root, "dist/unpacked");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const profile = await mkdtemp(resolve(tmpdir(), "chatgpt-feishu-extension-"));
let context;

try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? undefined : "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://chatgpt.com" });

  const page = context.pages()[0] || await context.newPage();
  await page.route("https://chatgpt.com/__feishu_extension_test__", (route) => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html><html><head><meta charset="utf-8"></head><body>
      <div class="group flex flex-col pb-2 pt-2" data-case="success">
        <div class="flex flex-col gap-3">
          <div class="block-BQZwFn">
            <div data-content-search-unit-key="fallback-turn-1:2:assistant">
              <h4 data-conversation-role="assistant">ChatGPT 说：</h4>
              <div data-markdown-text-style="assistant-message">
                <h2>真实扩展测试</h2>
                <p>回复末尾 EXTENSION_TAIL</p>
                <ul><li>列表项 LIST_ITEM</li></ul>
                <table><thead><tr><th>字段</th><th>结果</th></tr></thead><tbody><tr><td>表格</td><td>TABLE_CELL</td></tr></tbody></table>
              </div>
            </div>
          </div>
        </div>
        <div class="turn-action-controls"><button aria-label="复制" id="success-copy">原生复制</button></div>
      </div>
      <div class="group flex flex-col pb-2 pt-2" data-case="error">
        <div class="flex flex-col gap-3">
          <div class="block-BQZwFn">
            <div data-content-search-unit-key="fallback-turn-2:2:assistant">
              <h4 data-conversation-role="assistant">ChatGPT 说：</h4>
              <div data-markdown-text-style="assistant-message"><p>错误状态样本</p></div>
            </div>
          </div>
        </div>
        <div class="turn-action-controls"><button aria-label="复制" id="error-copy">原生复制</button></div>
      </div>
    </body></html>`
  }));
  await page.goto("https://chatgpt.com/__feishu_extension_test__");
  await page.evaluate(() => {
    const officialButton = document.querySelector("#success-copy");
    officialButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText([
        "## 真实扩展测试",
        "",
        "变量 (D_e)",
        "",
        "- 列表项 LIST_ITEM",
        "",
        "| 字段 | 结果 |",
        "| --- | --- |",
        "| 表格 | TABLE_CELL |",
        "",
        "[",
        "D_e={I_{e1},I_{e2}}",
        "]",
        "",
        "回复末尾 EXTENSION_TAIL"
      ].join("\n"));
      officialButton.setAttribute("aria-label", "Copied");
    });
  });

  const button = page.locator('[data-case="success"] [data-feishu-copy-button]');
  await button.waitFor();
  assert.equal(await page.locator("[data-feishu-copy-button]").count(), 2);
  assert.equal(await button.getAttribute("aria-label"), "复制飞书文档版");
  assert.equal(await button.getAttribute("data-feishu-copy-version"), manifest.version);
  assert.equal(await button.evaluate((node) => node.previousElementSibling?.getAttribute("aria-label")), "复制");

  await button.click();
  await page.locator('[data-feishu-copy-button][data-state="success"]').waitFor();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clipboardText, /^## 真实扩展测试/m);
  assert.match(clipboardText, /EXTENSION_TAIL/);
  assert.match(clipboardText, /变量 \$D_e\$/);
  assert.match(clipboardText, /^- 列表项 LIST_ITEM/m);
  assert.match(clipboardText, /\| 表格 \| TABLE_CELL \|/);
  assert.match(clipboardText, /\$\$\nD_e=\{I_\{e1\},I_\{e2\}\}\n\$\$/);

  await page.evaluate(() => document.querySelector("#error-copy").remove());
  const errorButton = page.locator('[data-case="error"] [data-feishu-copy-button]');
  await errorButton.click();
  await page.locator('[data-case="error"] [data-feishu-copy-button][data-state="error"]').waitFor();

  console.log("真实 Chromium 扩展加载、按钮注入、剪贴板写入、公式、列表、表格和错误状态测试通过。");
} finally {
  if (context) await context.close();
  await rm(profile, { force: true, recursive: true });
}
