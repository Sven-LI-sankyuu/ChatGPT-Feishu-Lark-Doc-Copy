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

    if (/^h[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${children().trim()}\n\n`;
    if (tag === "p" || tag === "div") return `\n\n${children().trim()}\n\n`;
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n\n---\n\n";
    if (tag === "strong" || tag === "b") return wrapInline("**", children());
    if (tag === "em" || tag === "i") return wrapInline("*", children());
    if (tag === "del" || tag === "s") return wrapInline("~~", children());
    if (tag === "u" || tag === "span") return children();
    if (tag === "code" && node.parentElement?.tagName.toLowerCase() !== "pre") return inlineCode(node.textContent);
    if (tag === "pre") return renderCodeBlock(node);
    if (tag === "blockquote") return renderBlockquote(node);
    if (tag === "ul" || tag === "ol") return `\n${renderList(node, 0)}\n`;
    if (tag === "table") return `\n\n${renderTable(node)}\n\n`;
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
    return `\n\n${fence}${language}\n${value}\n${fence}\n\n`;
  }

  function renderBlockquote(node) {
    const value = normalizeMarkdown(renderChildren(node));
    return `\n\n${value.split("\n").map((line) => `> ${line}`.trimEnd()).join("\n")}\n\n`;
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
    return String(text)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+\n/g, "\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  globalThis.ChatGPTFeishuCopyConverter = Object.freeze({
    convertDomToClipboard,
    convertExistingLatexDelimiters
  });
})();
