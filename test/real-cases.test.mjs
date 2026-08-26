/**
 * 历史真实 ChatGPT 官方复制结果的固定回归测试。
 *
 * 每个用例都读取官方复制文本，经过当前转换器生成结果，再与仓库中的固定期望文本逐字比较。
 * 同时运行 Markdown、LaTeX 和飞书块边界检查，并把实际文本和诊断报告写入 temp/real-cases。
 */

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { JSDOM } from "jsdom";
import { formatDiagnostics, validateMarkdown } from "../scripts/markdown-validator.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(root, "test/fixtures/real-cases");
const tempRoot = resolve(root, "temp/real-cases");
const manifest = JSON.parse(await readFile(resolve(fixtureRoot, "manifest.json"), "utf8"));
const converterSource = await readFile(resolve(root, "src/converter.js"), "utf8");
const dom = new JSDOM("<div></div>", {
  runScripts: "outside-only",
  url: "https://chatgpt.com/c/real-case"
});
dom.window.eval(converterSource);
const converter = dom.window.ChatGPTFeishuCopyConverter;

await mkdir(tempRoot, { recursive: true });

for (const realCase of manifest.cases) {
  test(`真实用例 ${realCase.id}：${realCase.name}`, async () => {
    const input = await readFile(resolve(fixtureRoot, realCase.input), "utf8");
    const expected = await readFile(resolve(fixtureRoot, realCase.expected), "utf8");
    const actual = converter.convertOfficialCopyToClipboard(input).text;
    const diagnostics = validateMarkdown(actual);
    const caseTempRoot = resolve(tempRoot, realCase.id);

    await mkdir(caseTempRoot, { recursive: true });
    await writeFile(resolve(caseTempRoot, "actual.md"), `${actual}\n`);
    await writeFile(resolve(caseTempRoot, "diagnostics.json"), JSON.stringify({
      id: realCase.id,
      name: realCase.name,
      errors: diagnostics.errors,
      warnings: diagnostics.warnings
    }, null, 2) + "\n");

    assert.equal(
      diagnostics.errors.length,
      0,
      formatDiagnostics(diagnostics, `真实用例 ${realCase.id}`)
    );
    assert.equal(actual, expected, createOutputMismatchMessage(realCase.id, expected, actual));
  });
}

/**
 * 生成固定期望文本和实际文本的首个差异位置。
 *
 * @param {string} id 用例 ID
 * @param {string} expected 固定期望文本
 * @param {string} actual 当前实际文本
 * @returns {string}
 */
function createOutputMismatchMessage(id, expected, actual) {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const lineCount = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < lineCount; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return [
        `真实用例 ${id} 输出不一致，首个差异在第 ${index + 1} 行。`,
        `期望：${expectedLines[index] ?? "<文件结束>"}`,
        `实际：${actualLines[index] ?? "<文件结束>"}`
      ].join("\n");
    }
  }
  return `真实用例 ${id} 输出长度不一致。`;
}
