/**
 * 启动加载本地构建扩展的专用 Chromium，并打开真实 ChatGPT。
 *
 * 浏览器配置保存在 temp/chromium-profile，首次登录后可在后续测试中复用会话；该配置与用户
 * 日常 Chrome 完全隔离。关闭专用浏览器窗口后，本脚本自动退出。
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = resolve(root, "dist/unpacked");
const profile = resolve(root, "temp/chromium-profile");
await mkdir(profile, { recursive: true });

const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`
  ],
  viewport: null
});

const pages = context.pages();
const page = pages[0] || await context.newPage();
await page.goto("https://chatgpt.com/");

console.log("已打开专用 ChatGPT 测试浏览器；关闭浏览器窗口即可结束测试。");
await new Promise((resolveClose) => context.on("close", resolveClose));
