/**
 * 在每条 ChatGPT 助手回复的原生复制按钮旁添加独立的飞书复制按钮。
 *
 * 内容脚本通过动态页面观察发现回复，将按钮与完整回复正文建立一对一关系；只有用户点击该
 * 按钮时才调用转换器并写入飞书已验证可解析的 Markdown，ChatGPT 的原生复制流程始终独立。
 */

(() => {
  "use strict";

  const converter = globalThis.ChatGPTFeishuCopyConverter;
  if (!converter) {
    console.error("[ChatGPT 飞书复制] 转换器未加载，按钮注入已停止。");
    return;
  }

  const BUTTON_ATTRIBUTE = "data-feishu-copy-button";
  const COPY_TEST_ID = "copy-turn-action-button";
  const TOOLTIP_ATTRIBUTE = "data-feishu-copy-tooltip";
  let scanScheduled = false;
  let tooltipOwner = null;

  function start() {
    scanAndInstallButtons();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;

    queueMicrotask(() => {
      scanScheduled = false;
      scanAndInstallButtons();
    });
  }

  function scanAndInstallButtons() {
    const assistantNodes = document.querySelectorAll('[data-message-author-role="assistant"]');

    for (const assistantNode of assistantNodes) {
      const contentNode = findAssistantContentNode(assistantNode);
      const turnNode = findTurnNode(assistantNode);
      const officialButton = turnNode && findOfficialCopyButton(turnNode);

      if (!contentNode || !officialButton) continue;

      const existingButton = officialButton.parentElement?.querySelector(`[${BUTTON_ATTRIBUTE}]`);
      if (existingButton) {
        syncButtonAppearance(existingButton, officialButton);
        continue;
      }

      const button = createCopyButton(contentNode, officialButton);
      syncButtonAppearance(button, officialButton);
      officialButton.insertAdjacentElement("afterend", button);
    }
  }

  function findAssistantContentNode(assistantNode) {
    return assistantNode.matches(".markdown")
      ? assistantNode
      : assistantNode.querySelector(".markdown") || assistantNode;
  }

  function findTurnNode(assistantNode) {
    return assistantNode.closest("article")
      || assistantNode.closest('[data-testid^="conversation-turn"]')
      || assistantNode.closest('[data-turn="assistant"]');
  }

  function findOfficialCopyButton(turnNode) {
    const exactButton = turnNode.querySelector(`button[data-testid="${COPY_TEST_ID}"]`);
    if (exactButton && !exactButton.closest("pre, code")) return exactButton;

    return Array.from(turnNode.querySelectorAll("button")).find((button) => {
      if (button.hasAttribute(BUTTON_ATTRIBUTE) || button.closest("pre, code")) return false;
      const label = [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.getAttribute("data-testid"),
        button.textContent
      ].filter(Boolean).join(" ").toLowerCase();
      return label.includes("copy") || label.includes("复制");
    }) || null;
  }

  function createCopyButton(contentNode, officialButton) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(BUTTON_ATTRIBUTE, "");
    button.setAttribute("aria-label", "复制飞书文档版");
    button.setAttribute("data-tooltip", "复制飞书文档版");
    button.setAttribute("aria-describedby", "feishu-copy-tooltip");
    button.innerHTML = clipboardIcon();
    button.addEventListener("click", (event) => handleFeishuCopy(event, button, contentNode));
    button.addEventListener("mouseenter", () => {
      syncButtonAppearance(button, officialButton);
      showTooltip(button);
    });
    button.addEventListener("mouseleave", () => hideTooltip(button));
    button.addEventListener("focus", () => {
      syncButtonAppearance(button, officialButton);
      showTooltip(button);
    });
    button.addEventListener("blur", () => hideTooltip(button));
    return button;
  }

  function syncButtonAppearance(button, officialButton) {
    if (!officialButton.isConnected) return;
    const officialStyle = getComputedStyle(officialButton);
    const officialIcon = officialButton.querySelector("svg");
    const iconStyle = officialIcon ? getComputedStyle(officialIcon) : officialStyle;
    const opacity = Number.parseFloat(officialStyle.opacity) * Number.parseFloat(iconStyle.opacity);
    button.style.setProperty("--feishu-copy-official-color", iconStyle.color || officialStyle.color);
    button.style.setProperty("--feishu-copy-official-opacity", String(opacity));
  }

  async function handleFeishuCopy(event, button, contentNode) {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.state === "copying") return;

    setButtonState(button, "copying", "正在复制飞书文档版");

    try {
      if (!contentNode.isConnected) throw new Error("这条回复已经离开页面，请刷新后重试。");
      const payload = converter.convertDomToClipboard(contentNode);
      await writeFeishuClipboard(payload.text);
      setButtonState(button, "success", "已复制飞书文档版, 去粘贴吧~");
      window.setTimeout(() => resetButton(button), 1600);
    } catch (error) {
      console.error("[ChatGPT 飞书复制] 复制失败：", error);
      setButtonState(button, "error", "复制飞书文档版失败, 请重试");
      window.setTimeout(() => resetButton(button), 3000);
    }
  }

  async function writeFeishuClipboard(text) {
    if (!navigator.clipboard?.writeText) {
      throw new Error("当前浏览器不支持文本剪贴板写入。");
    }

    await navigator.clipboard.writeText(text);
  }

  function setButtonState(button, state, message) {
    button.dataset.state = state;
    button.dataset.tooltip = message;
    button.setAttribute("aria-label", message);
    button.disabled = state === "copying";
    showTooltip(button);

    if (state === "success") button.innerHTML = checkIcon();
    if (state === "error") button.innerHTML = errorIcon();
  }

  function resetButton(button) {
    if (!button.isConnected) return;
    delete button.dataset.state;
    button.dataset.tooltip = "复制飞书文档版";
    button.setAttribute("aria-label", "复制飞书文档版");
    button.disabled = false;
    button.innerHTML = clipboardIcon();
    if (button.matches(":hover") || document.activeElement === button) {
      showTooltip(button);
    } else {
      hideTooltip(button, true);
    }
  }

  function getTooltip() {
    let tooltip = document.querySelector(`[${TOOLTIP_ATTRIBUTE}]`);
    if (tooltip) return tooltip;

    tooltip = document.createElement("div");
    tooltip.id = "feishu-copy-tooltip";
    tooltip.setAttribute(TOOLTIP_ATTRIBUTE, "");
    tooltip.setAttribute("role", "tooltip");
    document.body.append(tooltip);
    return tooltip;
  }

  function showTooltip(button) {
    if (!button.isConnected) return;
    const tooltip = getTooltip();
    tooltipOwner = button;
    tooltip.textContent = button.dataset.tooltip;
    tooltip.setAttribute("data-visible", "");
    positionTooltip(button, tooltip);
  }

  function hideTooltip(button, force = false) {
    if (!force && button.dataset.state) return;
    if (tooltipOwner !== button) return;

    document.querySelector(`[${TOOLTIP_ATTRIBUTE}]`)?.removeAttribute("data-visible");
    tooltipOwner = null;
  }

  function positionTooltip(button, tooltip) {
    const buttonRect = button.getBoundingClientRect();
    const top = buttonRect.bottom + 7;
    tooltip.style.left = "0px";
    tooltip.style.top = `${top}px`;

    const tooltipWidth = tooltip.getBoundingClientRect().width;
    const centered = buttonRect.left + buttonRect.width / 2 - tooltipWidth / 2;
    const maximum = Math.max(12, window.innerWidth - tooltipWidth - 12);
    tooltip.style.left = `${Math.min(Math.max(12, centered), maximum)}px`;
  }

  function icon(paths) {
    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  function clipboardIcon() {
    return icon([
      '<path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/>',
      '<path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/>',
      '<path d="M16 4h2a2 2 0 0 1 2 2v8"/>',
      '<path d="m15 18 3 3 3-3"/>',
      '<path d="M18 16v5"/>'
    ].join(""));
  }

  function checkIcon() {
    return icon('<path d="m5 12 4 4L19 6"/>');
  }

  function errorIcon() {
    return icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>');
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
