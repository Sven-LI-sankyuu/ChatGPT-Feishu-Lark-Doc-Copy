/**
 * 将一条 ChatGPT 助手回复转换成飞书粘贴所需的纯文本 Markdown。
 *
 * 转换流程：克隆回复、提取公式原文、移除页面控件、按允许列表清理节点，最后按语义生成
 * Markdown。模块不修改传入节点，也不访问剪贴板。
 */

(() => {
  "use strict";

  const ALLOWED_TAGS = new Set([
    "a", "b", "blockquote", "br", "code", "del", "div", "em", "h1", "h2", "h3",
    "h4", "h5", "h6", "hr", "i", "li", "ol", "p", "pre", "s", "span", "strong",
    "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul"
  ]);

  const DROP_SELECTORS = [
    "script", "style", "template", "button", "svg", "canvas", "form", "input", "select",
    "textarea", "audio", "video", "iframe", "object", "embed", "menu", "nav", "[role='toolbar']",
    "[data-feishu-copy-button]", "[data-feishu-copy-status]", "[data-feishu-copy-tooltip]",
    "[data-testid*='copy']"
  ].join(",");

  function convertExistingLatexDelimiters(text) {
    return String(text)
      .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, formula) => `$$\n${formula.trim()}\n$$`)
      .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, formula) => `$${formula.trim()}$`);
  }

  function convertOfficialCopyToClipboard(sourceText) {
    if (typeof sourceText !== "string") {
      throw new TypeError("官方复制结果必须是文本。");
    }

    const text = normalizeMarkdown(convertOfficialFormulaDelimiters(sourceText));
    if (!text) throw new Error("官方复制结果为空，已取消复制。");

    return Object.freeze({ text });
  }

  function convertOfficialFormulaDelimiters(sourceText) {
    const lines = String(sourceText).replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let fence = "";

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (fence) {
        output.push(line);
        if (trimmed.startsWith(fence)) fence = "";
        continue;
      }

      const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
      if (fenceMatch) {
        fence = fenceMatch[1];
        output.push(line);
        continue;
      }

      const closingDelimiter = trimmed === "\\[" ? "\\]" : trimmed === "[" ? "]" : "";
      if (closingDelimiter) {
        const closingIndex = findClosingDelimiter(lines, index + 1, closingDelimiter);
        const formulaLines = closingIndex >= 0 ? lines.slice(index + 1, closingIndex) : [];
        const isExplicitLatex = trimmed === "\\[";

        if (closingIndex >= 0 && (isExplicitLatex || looksLikeDisplayFormula(formulaLines))) {
          output.push("$$", ...normalizeOfficialDisplayFormula(formulaLines), "$$");
          index = closingIndex;
          continue;
        }
      }

      output.push(convertInlineFormulaDelimiters(line));
    }

    return output.join("\n");
  }

  function findClosingDelimiter(lines, startIndex, delimiter) {
    for (let index = startIndex; index < lines.length; index += 1) {
      if (lines[index].trim() === delimiter) return index;
    }
    return -1;
  }

  function looksLikeDisplayFormula(lines) {
    const value = lines.join("\n").trim();
    if (!value) return false;

    return /\\[A-Za-z]+|[_^{}]|(?:^|\s)[=<>≤≥∈∑∏±→⟶](?:\s|$)/u.test(value);
  }

  function normalizeOfficialDisplayFormula(lines) {
    const hasMultilineEnvironment = lines.some((line) => /\\begin\{(?:aligned|array|cases|matrix|pmatrix|bmatrix|vmatrix)\}/.test(line));
    const normalized = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      if (/^\s*={3,}\s*$/.test(line)) {
        normalized.push("=");
        continue;
      }

      const subtractionHeading = line.match(/^\s*##\s+(.+?)\s*$/);
      if (subtractionHeading) {
        normalized.push(subtractionHeading[1], "-");
        continue;
      }

      normalized.push(hasMultilineEnvironment ? line.replace(/(?<!\\)\\\s*$/, "\\\\") : line);
    }

    return normalized;
  }

  function convertInlineFormulaDelimiters(line) {
    const codeSpanPattern = /(`+)(.*?)\1/g;
    const output = [];
    let cursor = 0;
    let match;

    while ((match = codeSpanPattern.exec(line))) {
      output.push(convertInlineText(line.slice(cursor, match.index)), match[0]);
      cursor = match.index + match[0].length;
    }

    output.push(convertInlineText(line.slice(cursor)));
    return output.join("");
  }

  function convertInlineText(text) {
    const explicit = String(text).replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, formula) => `$${formula.trim()}$`);
    let output = "";

    for (let index = 0; index < explicit.length; index += 1) {
      if (explicit[index] !== "(" || explicit[index - 1] === "\\") {
        output += explicit[index];
        continue;
      }

      const closingIndex = findMatchingParenthesis(explicit, index);
      if (closingIndex < 0) {
        output += explicit[index];
        continue;
      }

      const formula = explicit.slice(index + 1, closingIndex).trim();
      if (!looksLikeInlineFormula(formula)) {
        output += explicit.slice(index, closingIndex + 1);
        index = closingIndex;
        continue;
      }

      output += `$${formula}$`;
      index = closingIndex;
    }

    return output;
  }

  function findMatchingParenthesis(text, openingIndex) {
    let depth = 0;

    for (let index = openingIndex; index < text.length; index += 1) {
      if (text[index] === "(" && text[index - 1] !== "\\") depth += 1;
      if (text[index] === ")" && text[index - 1] !== "\\") depth -= 1;
      if (depth === 0) return index;
    }

    return -1;
  }

  function looksLikeInlineFormula(value) {
    if (!value || value.includes("$") || /https?:\/\//i.test(value)) return false;
    if (/^[A-Za-zα-ωΑ-Ω]$/u.test(value)) return true;
    if (/\\[A-Za-z]+/.test(value)) return true;
    if (/[_^{}]/.test(value)) return true;
    return !/[\p{Script=Han}]/u.test(value) && /[A-Za-zα-ωΑ-Ω]/u.test(value) && /[=<>≤≥∈±→]/u.test(value);
  }

  function convertDomToClipboard(sourceRoot) {
    if (!sourceRoot?.cloneNode) {
      throw new TypeError("转换器需要一个可克隆的 DOM 根节点。");
    }

    const root = sourceRoot.cloneNode(true);
    replaceMathWithLatex(root);
    normalizeTextLatex(root);
    removeUiNoise(root);
    sanitizeTree(root);

    const text = normalizeMarkdown(renderChildren(root));

    if (!text) {
      throw new Error("助手回复转换后为空，已取消复制。");
    }

    return Object.freeze({ text });
  }

  function replaceMathWithLatex(root) {
    for (const node of Array.from(root.querySelectorAll(".katex-display"))) {
      replaceMathNode(node, true);
    }

    for (const node of Array.from(root.querySelectorAll(".katex"))) {
      if (!node.closest(".katex-display")) replaceMathNode(node, false);
    }

    for (const node of Array.from(root.querySelectorAll("mjx-container"))) {
      replaceMathNode(node, node.getAttribute("display") === "true");
    }
  }

  function replaceMathNode(node, display) {
    const tex = extractTex(node);
    if (!tex) return;

    if (display) {
      const paragraph = node.ownerDocument.createElement("p");
      appendLinesWithBreaks(paragraph, ["$$", ...tex.split("\n"), "$$"]);
      node.replaceWith(paragraph);
      return;
    }

    node.replaceWith(node.ownerDocument.createTextNode(`$${tex}$`));
  }

  function appendLinesWithBreaks(element, lines) {
    lines.forEach((line, index) => {
      if (index) element.append(element.ownerDocument.createElement("br"));
      element.append(element.ownerDocument.createTextNode(line));
    });
  }

  function extractTex(node) {
    const annotation = node.querySelector?.([
      'annotation[encoding="application/x-tex"]',
      'annotation[encoding="application/tex"]',
      'annotation[encoding="TeX"]'
    ].join(","));

    if (annotation?.textContent?.trim()) return annotation.textContent.trim();

    for (const attribute of ["data-latex", "data-tex"]) {
      const value = node.getAttribute?.(attribute);
      if (value?.trim()) return value.trim();
    }

    return "";
  }

  function normalizeTextLatex(root) {
    const document = root.ownerDocument;
    const walker = document.createTreeWalker(root, document.defaultView.NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      if (node.parentElement?.closest("pre, code")) continue;
      node.nodeValue = convertExistingLatexDelimiters(node.nodeValue);
    }
  }

  function removeUiNoise(root) {
    root.querySelectorAll(DROP_SELECTORS).forEach((node) => node.remove());
  }

  function sanitizeTree(root) {
    for (const element of Array.from(root.querySelectorAll("*"))) {
      const tag = element.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        element.replaceWith(...element.childNodes);
        continue;
      }

      const preserved = preservedAttributes(element, tag);
      for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
      for (const [name, value] of preserved) element.setAttribute(name, value);
    }
  }

  function preservedAttributes(element, tag) {
    const attributes = [];

    if (tag === "a") {
      const href = safeLink(element.getAttribute("href"), element.ownerDocument.baseURI);
      if (href) attributes.push(["href", href]);
      const title = element.getAttribute("title")?.trim();
      if (title) attributes.push(["title", title]);
    }

    if (tag === "td" || tag === "th") {
      for (const name of ["colspan", "rowspan"]) {
        const value = element.getAttribute(name);
        if (value && /^\d+$/.test(value)) attributes.push([name, value]);
      }
    }

    if (tag === "ol") {
      const start = element.getAttribute("start");
      if (start && /^-?\d+$/.test(start)) attributes.push(["start", start]);
    }

    if (tag === "code") {
      const language = Array.from(element.classList).find((name) => /^language-[\w+-]+$/.test(name));
      if (language) attributes.push(["class", language]);
    }

    return attributes;
  }

  function safeLink(rawHref, baseUrl) {
    if (!rawHref) return "";
    const href = rawHref.trim();
    if (href.startsWith("#")) return href;

    try {
      const url = new URL(href, baseUrl);
      return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function renderChildren(node) {
    return Array.from(node.childNodes).map((child) => renderNode(child)).join("");
  }

  function renderNode(node) {
    const Node = node.ownerDocument.defaultView.Node;
    if (node.nodeType === Node.TEXT_NODE) return normalizeTextNode(node.nodeValue);
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    const children = () => renderChildren(node);

    if (/^h[1-6]$/.test(tag)) return `\n${"#".repeat(Number(tag[1]))} ${children().trim()}\n`;
    if (tag === "p" || tag === "div") return `\n${children().trim()}\n`;
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n";
    if (tag === "strong" || tag === "b") return wrapInline("**", children());
    if (tag === "em" || tag === "i") return wrapInline("*", children());
    if (tag === "del" || tag === "s") return wrapInline("~~", children());
    if (tag === "u" || tag === "span") return children();
    if (tag === "code" && node.parentElement?.tagName.toLowerCase() !== "pre") return inlineCode(node.textContent);
    if (tag === "pre") return renderCodeBlock(node);
    if (tag === "blockquote") return renderBlockquote(node);
    if (tag === "ul" || tag === "ol") return `\n${renderList(node, 0)}\n`;
    if (tag === "table") return `\n${renderTable(node)}\n`;
    if (tag === "a") return renderLink(node, children());
    if (["thead", "tbody", "tfoot", "tr", "th", "td", "li"].includes(tag)) return children();
    return children();
  }

  function normalizeTextNode(text) {
    return String(text)
      .split(/(\$\$\n[\s\S]*?\n\$\$)/g)
      .map((part) => part.startsWith("$$\n") ? part : part.replace(/\s+/g, " "))
      .join("");
  }

  function wrapInline(marker, content) {
    const value = content.trim();
    return value ? `${marker}${value}${marker}` : "";
  }

  function inlineCode(text) {
    const value = String(text);
    const marker = value.includes("`") ? "``" : "`";
    return `${marker}${value}${marker}`;
  }

  function renderCodeBlock(pre) {
    const code = pre.querySelector("code");
    const language = code
      ? Array.from(code.classList).find((name) => name.startsWith("language-"))?.slice(9) || ""
      : "";
    const value = (code || pre).textContent.replace(/^\n|\n$/g, "");
    const fence = value.includes("```") ? "~~~~" : "```";
    return `\n${fence}${language}\n${value}\n${fence}\n`;
  }

  function renderBlockquote(node) {
    const value = normalizeMarkdown(renderChildren(node));
    return `\n${value.split("\n").map((line) => `> ${line}`.trimEnd()).join("\n")}\n`;
  }

  function renderList(list, depth) {
    const ordered = list.tagName.toLowerCase() === "ol";
    const start = Number.parseInt(list.getAttribute("start") || "1", 10);
    const items = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === "li");

    return items.map((item, index) => {
      const nestedLists = Array.from(item.children).filter((child) => ["ul", "ol"].includes(child.tagName.toLowerCase()));
      const content = Array.from(item.childNodes)
        .filter((child) => !nestedLists.includes(child))
        .map((child) => renderNode(child))
        .join("")
        .trim()
        .replace(/\n{2,}/g, "\n");
      const prefix = ordered ? `${start + index}. ` : "- ";
      const indent = "  ".repeat(depth);
      const continuation = `${indent}${" ".repeat(prefix.length)}`;
      const body = content.split("\n").map((line, lineIndex) => `${lineIndex ? continuation : indent + prefix}${line}`).join("\n");
      const nested = nestedLists.map((child) => `\n${renderList(child, depth + 1)}`).join("");
      return body + nested;
    }).join("\n");
  }

  function renderTable(table) {
    const rows = Array.from(table.rows);
    if (!rows.length) return "";

    const values = rows.map((row) => Array.from(row.cells).map((cell) => tableCellText(cell)));
    const width = Math.max(...values.map((row) => row.length));
    const normalized = values.map((row) => [...row, ...Array(width - row.length).fill("")]);
    const headerIndex = rows.findIndex((row) => Array.from(row.cells).some((cell) => cell.tagName.toLowerCase() === "th"));
    const selectedHeader = headerIndex >= 0 ? headerIndex : 0;
    const header = normalized[selectedHeader];
    const body = normalized.filter((_, index) => index !== selectedHeader);
    const line = (cells) => `| ${cells.join(" | ")} |`;

    return [line(header), line(Array(width).fill("---")), ...body.map(line)].join("\n");
  }

  function tableCellText(cell) {
    return normalizeMarkdown(renderChildren(cell))
      .replace(/\n+/g, "<br>")
      .replace(/\|/g, "\\|")
      .trim();
  }

  function renderLink(node, content) {
    const label = content.trim();
    const href = node.getAttribute("href");
    if (!href || !label) return label;
    return `[${label.replace(/]/g, "\\]")}](${href.replace(/\)/g, "\\)")})`;
  }

  function normalizeMarkdown(text) {
    const output = [];
    let protectedBlock = "";

    for (const rawLine of String(text).replace(/\r\n?/g, "\n").split("\n")) {
      const line = rawLine.replace(/[ \t]+$/g, "");
      const trimmed = line.trim();

      if (protectedBlock) {
        output.push(line);
        const closesFormula = protectedBlock === "formula" && trimmed === "$$";
        const closesFence = protectedBlock !== "formula" && trimmed === protectedBlock;
        if (closesFormula || closesFence) protectedBlock = "";
        continue;
      }

      const fence = trimmed.match(/^(```|~~~~)/)?.[1];
      if (fence) {
        protectedBlock = fence;
        output.push(line.trimStart());
        continue;
      }

      if (trimmed === "$$") {
        protectedBlock = "formula";
        output.push("$$");
        continue;
      }

      if (trimmed) output.push(line);
    }

    return output.join("\n").trim();
  }

  globalThis.ChatGPTFeishuCopyConverter = Object.freeze({
    convertDomToClipboard,
    convertExistingLatexDelimiters,
    convertOfficialCopyToClipboard
  });
})();
