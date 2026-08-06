/**
 * 在真实 Chromium 扩展环境中验证构建产物。
 *
 * 测试浏览器加载 dist/unpacked，并在 chatgpt.com 域名下拦截一条固定回复页面；随后检查
 * Manifest V3 内容脚本是否注入按钮、按钮是否紧邻官方复制按钮，以及最终 Markdown 是否
 * 真正进入浏览器剪贴板。测试不访问用户账号。
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = resolve(root, "dist/unpacked");
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
      <article data-testid="conversation-turn-2">
        <div data-message-author-role="assistant"><div class="markdown"><h2>真实扩展测试</h2><p>回复末尾 EXTENSION_TAIL</p></div></div>
        <div><button data-testid="copy-turn-action-button" aria-label="Copy">原生复制</button></div>
      </article>
    </body></html>`
  }));
  await page.goto("https://chatgpt.com/__feishu_extension_test__");
  await page.evaluate(() => {
    const officialButton = document.querySelector('button[data-testid="copy-turn-action-button"]');
    officialButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText([
        "## 真实扩展测试",
        "",
        "变量 (D_e)",
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

  const button = page.locator("[data-feishu-copy-button]");
  await button.waitFor();
  assert.equal(await button.count(), 1);
  assert.equal(await button.getAttribute("aria-label"), "复制飞书文档版");
  assert.equal(await button.getAttribute("data-feishu-copy-version"), "0.1.2");
  assert.equal(await button.evaluate((node) => node.previousElementSibling?.getAttribute("data-testid")), "copy-turn-action-button");

  await button.click();
  await page.locator('[data-feishu-copy-button][data-state="success"]').waitFor();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clipboardText, /^## 真实扩展测试/m);
  assert.match(clipboardText, /EXTENSION_TAIL/);
  assert.match(clipboardText, /变量 \$D_e\$/);
  assert.match(clipboardText, /\$\$\nD_e=\{I_\{e1\},I_\{e2\}\}\n\$\$/);

  console.log("真实 Chromium 扩展加载、按钮注入与剪贴板写入测试通过。");
} finally {
  if (context) await context.close();
  await rm(profile, { force: true, recursive: true });
}
