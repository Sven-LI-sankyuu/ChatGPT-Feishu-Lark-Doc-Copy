/**
 * Markdown 回归检查器的行为测试。
 *
 * 测试有效结果可以通过 Markdown 与 LaTeX 检查，并确认损坏的公式、表格、引用和分隔线
 * 会带着具体行号被报告出来。
 */

import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics, validateMarkdown } from "../scripts/markdown-validator.mjs";

test("有效 Markdown、公式和块边界通过检查", () => {
  const text = [
    "# 标题",
    "段落中的公式 $f(x)=x^2$。",
    "",
    "> 引用内容",
    "",
    "| 字段 | 值 |",
    "| --- | --- |",
    "| 公式 | $x+y$ |",
    "",
    "---",
    "",
    "## 后续标题"
  ].join("\n");

  const diagnostics = validateMarkdown(text);

  assert.deepEqual(diagnostics.errors, []);
  assert.deepEqual(diagnostics.warnings, []);
  assert.match(diagnostics.html, /<h1>标题<\/h1>/);
});

test("损坏的公式和表格报告具体行号", () => {
  const text = [
    "正常段落。",
    "$$",
    "\\frac{1}{",
    "$$",
    "| 字段 | 值 |",
    "| --- | --- | --- |",
    "| 内容 | 多余列 | 第三列 |",
    "表格后的正文。"
  ].join("\n");

  const diagnostics = validateMarkdown(text);
  const report = formatDiagnostics(diagnostics, "invalid.md");

  assert.ok(diagnostics.errors.some((item) => item.code === "invalid-latex" && item.line === 2));
  assert.ok(diagnostics.errors.some((item) => item.code === "table-header-width-mismatch" && item.line === 6));
  assert.ok(diagnostics.errors.some((item) => item.code === "table-row-width-mismatch" && item.line === 7));
  assert.ok(diagnostics.errors.some((item) => item.code === "table-missing-boundary" && item.line === 8));
  assert.match(report, /invalid\.md:2/);
  assert.match(report, /invalid\.md:6/);
  assert.match(report, /invalid\.md:8/);
});

test("未闭合的行内公式、引用和分隔线分别报告", () => {
  const text = [
    "行内公式 $x^2",
    "> 引用",
    "后续正文",
    "---",
    "后续标题"
  ].join("\n");

  const diagnostics = validateMarkdown(text);

  assert.ok(diagnostics.errors.some((item) => item.code === "unclosed-inline-formula" && item.line === 1));
  assert.ok(diagnostics.errors.some((item) => item.code === "blockquote-missing-boundary" && item.line === 3));
  assert.ok(diagnostics.errors.some((item) => item.code === "thematic-break-missing-before-boundary" && item.line === 4));
  assert.ok(diagnostics.errors.some((item) => item.code === "thematic-break-missing-after-boundary" && item.line === 5));
});
