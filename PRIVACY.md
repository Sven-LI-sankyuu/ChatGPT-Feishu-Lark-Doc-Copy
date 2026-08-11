# Privacy Policy / 隐私政策

Effective date / 生效日期：2026-08-12

ChatGPT 飞书文档复制是一个本地运行的浏览器扩展。扩展只在用户主动点击“复制飞书文档版”按钮时处理当前 ChatGPT 回复，并把转换后的 Markdown 写入系统剪贴板。

## Data Handling / 数据处理

- The extension does not collect, transmit, sell, or share chat content, clipboard content, personal information, browsing history, analytics data, or usage telemetry.
- The extension reads the clipboard only after the user clicks the extension copy button, because ChatGPT first places its official Markdown copy result on the clipboard.
- The extension immediately converts that text locally and writes the Feishu/Lark-compatible Markdown back to the clipboard.
- The extension does not store chat content locally or remotely.
- The extension does not load remote code and does not connect to a project server.

## Permissions / 权限说明

- `clipboardRead` is used only to read the official ChatGPT copy result after the user clicks the extension copy button.
- `clipboardWrite` is used only to write the converted Markdown result back to the clipboard.
- Host access is limited to `https://chatgpt.com/*` and `https://chat.openai.com/*`, where the content script adds the extra copy button next to ChatGPT's native copy button.

## Third Parties / 第三方

This extension is independent and is not affiliated with OpenAI, Feishu, or Lark. It does not use third-party analytics, advertising, tracking, or remote processing services.

## Changes / 变更

Policy updates will be committed to this repository. For questions, please open an issue in the public project repository.
