/**
 * 检查转换结果是否同时满足通用 Markdown、LaTeX 公式和飞书块边界约束。
 *
 * 流程：先用 marked 解析 Markdown，再扫描代码块、公式块、行内公式、表格、引用和分隔线。
 * 结构扫描会保留 1 起始的行号，供真实用例回归测试和命令行诊断直接使用。
 */

import { readFile } from "node:fs/promises";
import process from "node:process";
import { marked } from "marked";
import katex from "katex";

const PIPE_TABLE_LINE = /^\s*\|.*\|\s*$/;
const THEMATIC_BREAK_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
/**
 * 检查 Markdown 文本并返回可供测试和人工排障使用的诊断结果。
 *
 * @param {string} text 待检查的 Markdown 文本
 * @returns {{errors: Array<object>, warnings: Array<object>, html: string}}
 */
export function validateMarkdown(text) {
  if (typeof text !== "string") {
    throw new TypeError("Markdown 校验器需要文本输入。");
  }

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const diagnostics = {
    errors: [],
    warnings: [],
    html: ""
  };

  try {
    diagnostics.html = marked.parse(text, { gfm: true });
  } catch (error) {
    addDiagnostic(diagnostics.errors, "markdown-parse-error", 1, `Markdown 解析失败：${error.message}`);
  }

  const protectedRanges = scanBlockRanges(lines, diagnostics);
  scanInlineFormulas(lines, protectedRanges, diagnostics);
  scanTables(lines, protectedRanges, diagnostics);
  scanBlockquotes(lines, protectedRanges, diagnostics);
  scanThematicBreaks(lines, protectedRanges, diagnostics);

  return diagnostics;
}

/**
 * 扫描代码块和独立行间公式，并验证每个公式块的 LaTeX 内容。
 *
 * @param {string[]} lines Markdown 行
 * @param {{errors: Array<object>, warnings: Array<object>}} diagnostics 诊断容器
 * @returns {Array<{type: string, start: number, end: number}>} 受保护区域
 */
function scanBlockRanges(lines, diagnostics) {
  const ranges = [];
  let fence = null;
  let formula = null;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (fence) {
      if (isFenceClose(trimmed, fence)) {
        ranges.push({ type: "fence", start: fence.start, end: index });
        fence = null;
      }
      continue;
    }

    if (formula) {
      if (trimmed === "$$") {
        const content = lines.slice(formula.start + 1, index).join("\n").trim();
        if (!content) {
          addDiagnostic(diagnostics.errors, "empty-formula-block", formula.start + 1, "行间公式块没有内容。");
        } else {
          validateLatex(content, diagnostics, formula.start + 1, "行间公式");
        }
        ranges.push({ type: "formula", start: formula.start, end: index });
        formula = null;
      }
      continue;
    }

    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      fence = {
        marker: fenceMatch[1][0],
        length: fenceMatch[1].length,
        start: index
      };
      continue;
    }

    if (trimmed === "$$") {
      formula = { start: index };
    }
  }

  if (fence) {
    addDiagnostic(diagnostics.errors, "unclosed-code-fence", fence.start + 1, "代码围栏没有结束定界符。");
  }

  if (formula) {
    addDiagnostic(diagnostics.errors, "unclosed-formula-block", formula.start + 1, "行间公式没有结束的 `$$` 定界符。");
  }

  return ranges;
}

/**
 * 扫描非代码、非行间公式区域中的行内公式。
 *
 * @param {string[]} lines Markdown 行
 * @param {Array<{type: string, start: number, end: number}>} protectedRanges 受保护区域
 * @param {{errors: Array<object>, warnings: Array<object>}} diagnostics 诊断容器
 */
function scanInlineFormulas(lines, protectedRanges, diagnostics) {
  for (let index = 0; index < lines.length; index += 1) {
    if (isProtectedLine(index, protectedRanges)) continue;
    const line = removeInlineCode(lines[index]);

    for (let cursor = 0; cursor < line.length; cursor += 1) {
      if (line[cursor] !== "$" || line[cursor - 1] === "\\") continue;

      if (line[cursor + 1] === "$") {
        addDiagnostic(
          diagnostics.errors,
          "inline-double-dollar",
          index + 1,
          "行内文本中出现连续 `$$`，行间公式应使用独立的开始和结束行。"
        );
        cursor += 1;
        continue;
      }

      const closing = findClosingDollar(line, cursor);
      if (closing < 0) {
        addDiagnostic(diagnostics.errors, "unclosed-inline-formula", index + 1, "行内公式缺少结束的 `$` 定界符。");
        break;
      }

      const content = line.slice(cursor + 1, closing).trim();
      if (!content) {
        addDiagnostic(diagnostics.errors, "empty-inline-formula", index + 1, "行内公式不能为空。");
      } else {
        validateLatex(content, diagnostics, index + 1, "行内公式");
      }

      cursor = closing;
    }
  }
}

/**
 * 检查管道表格的分隔线、列数和结束空行。
 *
 * @param {string[]} lines Markdown 行
 * @param {Array<{type: string, start: number, end: number}>} protectedRanges 受保护区域
 * @param {{errors: Array<object>, warnings: Array<object>}} diagnostics 诊断容器
 */
function scanTables(lines, protectedRanges, diagnostics) {
  for (let index = 0; index < lines.length; index += 1) {
    if (isProtectedLine(index, protectedRanges) || !isPipeTableLine(lines[index])) continue;

    const next = lines[index + 1] || "";
    if (!isPipeTableDelimiterLine(next)) {
      addDiagnostic(
        diagnostics.warnings,
        "table-candidate-without-delimiter",
        index + 1,
        "这一行看起来像管道表格，但下一行不是合法的表头分隔线。"
      );
      continue;
    }

    const width = splitTableCells(lines[index]).length;
    const delimiterWidth = splitTableCells(next).length;
    if (width !== delimiterWidth) {
      addDiagnostic(
        diagnostics.errors,
        "table-header-width-mismatch",
        index + 2,
        `表头有 ${width} 列，但分隔线有 ${delimiterWidth} 列。`
      );
    }

    let rowIndex = index + 2;
    while (rowIndex < lines.length && isPipeTableLine(lines[rowIndex])) {
      const rowWidth = splitTableCells(lines[rowIndex]).length;
      if (rowWidth !== width) {
        addDiagnostic(
          diagnostics.errors,
          "table-row-width-mismatch",
          rowIndex + 1,
          `表格正文有 ${rowWidth} 列，表头应为 ${width} 列。`
        );
      }
      rowIndex += 1;
    }

    if (rowIndex < lines.length && lines[rowIndex].trim()) {
      addDiagnostic(
        diagnostics.errors,
        "table-missing-boundary",
        rowIndex + 1,
        "表格结束后缺少空行，后续正文可能继续被飞书识别为表格内容。"
      );
    }

    index = rowIndex - 1;
  }
}

/**
 * 检查引用块结束后的空行。
 *
 * @param {string[]} lines Markdown 行
 * @param {Array<{type: string, start: number, end: number}>} protectedRanges 受保护区域
 * @param {{errors: Array<object>, warnings: Array<object>}} diagnostics 诊断容器
 */
function scanBlockquotes(lines, protectedRanges, diagnostics) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (isProtectedLine(index, protectedRanges)) continue;
    if (!isBlockquoteLine(lines[index])) continue;

    const next = lines[index + 1];
    if (next.trim() && !isBlockquoteLine(next)) {
      addDiagnostic(
        diagnostics.errors,
        "blockquote-missing-boundary",
        index + 2,
        "引用块结束后缺少空行，后续正文可能继续被识别为引用内容。"
      );
    }
  }
}

/**
 * 检查分隔线前后的空行，避免 Setext 标题和普通段落边界混淆。
 *
 * @param {string[]} lines Markdown 行
 * @param {Array<{type: string, start: number, end: number}>} protectedRanges 受保护区域
 * @param {{errors: Array<object>, warnings: Array<object>}} diagnostics 诊断容器
 */
function scanThematicBreaks(lines, protectedRanges, diagnostics) {
  for (let index = 0; index < lines.length; index += 1) {
    if (isProtectedLine(index, protectedRanges) || !THEMATIC_BREAK_LINE.test(lines[index])) continue;

    const previous = lines[index - 1];
    const next = lines[index + 1];
    if (previous?.trim()) {
      addDiagnostic(
        diagnostics.errors,
        "thematic-break-missing-before-boundary",
        index + 1,
        "分隔线前缺少空行，上一段正文可能被识别为 Setext 标题。"
      );
    }
    if (next?.trim()) {
      addDiagnostic(
        diagnostics.errors,
        "thematic-break-missing-after-boundary",
        index + 2,
        "分隔线后缺少空行，后续标题或正文的块边界不明确。"
      );
    }
  }
}

/**
 * 用 KaTeX 检查公式语法，并把解析失败映射到公式所在行。
 *
 * @param {string} formula LaTeX 公式
 * @param {{errors: Array<object>}} diagnostics 诊断容器
 * @param {number} lineNumber 公式起始行号
 * @param {string} label 公式类型
 */
function validateLatex(formula, diagnostics, lineNumber, label) {
  try {
    katex.renderToString(formula, {
      displayMode: label === "行间公式",
      throwOnError: true,
      strict: "error"
    });
  } catch (error) {
    addDiagnostic(diagnostics.errors, "invalid-latex", lineNumber, `${label} LaTeX 无法解析：${error.message}`);
  }
}

/**
 * 判断某一行是否属于代码块或行间公式块。
 *
 * @param {number} index 0 起始行号
 * @param {Array<{type: string, start: number, end: number}>} protectedRanges 受保护区域
 * @returns {boolean}
 */
function isProtectedLine(index, protectedRanges) {
  return protectedRanges.some((range) => index >= range.start && index <= range.end);
}

/**
 * 移除行内代码内容，避免代码中的美元符号被误判成公式。
 *
 * @param {string} line Markdown 行
 * @returns {string}
 */
function removeInlineCode(line) {
  return line.replace(/(`+)(.*?)\1/g, (match) => " ".repeat(match.length));
}

/**
 * 找到未转义的行内公式结束美元符号。
 *
 * @param {string} line Markdown 行
 * @param {number} openingIndex 开始美元符号位置
 * @returns {number}
 */
function findClosingDollar(line, openingIndex) {
  for (let index = openingIndex + 1; index < line.length; index += 1) {
    if (line[index] === "$" && line[index - 1] !== "\\") return index;
  }
  return -1;
}

/**
 * 判断一行是否可能是管道表格行。
 *
 * @param {string} line Markdown 行
 * @returns {boolean}
 */
function isPipeTableLine(line) {
  return PIPE_TABLE_LINE.test(line) && splitTableCells(line).length >= 2;
}

/**
 * 判断一行是否是合法的 Markdown 表头分隔线。
 *
 * @param {string} line Markdown 行
 * @returns {boolean}
 */
function isPipeTableDelimiterLine(line) {
  if (!isPipeTableLine(line)) return false;
  return splitTableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

/**
 * 分割表格单元格并忽略转义管道符。
 *
 * @param {string} line Markdown 表格行
 * @returns {string[]}
 */
function splitTableCells(line) {
  const value = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cell = "";
  let escaped = false;

  for (const character of value) {
    if (character === "|" && !escaped) {
      cells.push(cell);
      cell = "";
      continue;
    }
    cell += character;
    escaped = character === "\\" && !escaped;
    if (character !== "\\") escaped = false;
  }

  cells.push(cell);
  return cells;
}

/**
 * 判断一行是否是引用内容。
 *
 * @param {string} line Markdown 行
 * @returns {boolean}
 */
function isBlockquoteLine(line) {
  return line.trimStart().startsWith(">");
}

/**
 * 判断代码围栏关闭行是否匹配开始围栏。
 *
 * @param {string} line 去除首尾空白后的行
 * @param {{marker: string, length: number}} fence 开始围栏
 * @returns {boolean}
 */
function isFenceClose(line, fence) {
  const match = line.match(/^(`+|~+)/);
  return Boolean(match && match[0][0] === fence.marker && match[0].length >= fence.length && !line.slice(match[0].length).trim());
}

/**
 * 写入一条带行号的诊断信息。
 *
 * @param {Array<object>} target 诊断数组
 * @param {string} code 稳定诊断代码
 * @param {number} line 行号
 * @param {string} message 人类可读信息
 */
function addDiagnostic(target, code, line, message) {
  target.push({ code, line, message });
}

/**
 * 将诊断结果格式化成适合命令行和断言失败信息的文本。
 *
 * @param {{errors: Array<object>, warnings: Array<object>}} diagnostics 诊断结果
 * @param {string} label 样本名称
 * @returns {string}
 */
export function formatDiagnostics(diagnostics, label = "Markdown") {
  const lines = [];
  for (const item of diagnostics.errors) lines.push(`[ERROR] ${label}:${item.line} ${item.code} ${item.message}`);
  for (const item of diagnostics.warnings) lines.push(`[WARN] ${label}:${item.line} ${item.code} ${item.message}`);
  return lines.join("\n") || `${label}: 未发现结构问题。`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const filePaths = process.argv.slice(2);
  if (!filePaths.length) {
    console.error("用法：node scripts/markdown-validator.mjs <markdown-file> [markdown-file...]");
    process.exitCode = 2;
  } else {
    let hasError = false;
    for (const filePath of filePaths) {
      const text = await readFile(filePath, "utf8");
      const diagnostics = validateMarkdown(text);
      console.log(formatDiagnostics(diagnostics, filePath));
      hasError ||= diagnostics.errors.length > 0;
    }
    process.exitCode = hasError ? 1 : 0;
  }
}
