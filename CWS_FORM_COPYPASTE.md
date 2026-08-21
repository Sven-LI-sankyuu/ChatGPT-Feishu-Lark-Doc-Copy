# Chrome Web Store 表单复制稿

## 扩展名称

ChatGPT 飞书文档复制

## 简短描述

在 ChatGPT 回复旁一键复制飞书文档版 Markdown，保留标题、公式、列表和表格。

## 详细描述

ChatGPT 飞书文档复制会在 ChatGPT 官方复制按钮旁增加一个独立按钮。点击后，扩展读取 ChatGPT 官方复制结果，在本地转换为飞书文档更容易识别的 Markdown，再写回剪贴板。

粘贴到飞书文档后，可以保留标题层级、段落、列表、引用、行内公式、行间公式、表格、超链接、粗体、斜体和删除线。默认采用紧凑排版，减少飞书里多出来的空白段落。

扩展不会修改 ChatGPT 原生复制按钮的行为。它只在用户点击飞书文档版按钮时读取一次剪贴板，用于取得 ChatGPT 官方 Markdown，并立即写回转换结果。

本扩展独立开发，与 OpenAI、飞书或 Lark 没有官方关联。

## 类别

Productivity

## 语言

Chinese Simplified

## 隐私政策 URL

https://raw.githubusercontent.com/Sven-LI-sankyuu/ChatGPT-Feishu-Lark-Doc-Copy/main/PRIVACY.md

## 单一用途说明

本扩展的单一用途是在用户主动点击扩展按钮后，把当前 ChatGPT 回复转换为适合粘贴到飞书文档的 Markdown。

## 权限说明

`clipboardRead`：用户点击扩展按钮后，读取 ChatGPT 官方复制按钮刚写入剪贴板的 Markdown。

`clipboardWrite`：把本地转换后的飞书文档版 Markdown 写回剪贴板。

Host permissions：内容脚本只运行在 `https://chatgpt.com/*` 和 `https://chat.openai.com/*`，用于在 ChatGPT 回复的官方复制按钮旁添加独立按钮。

## 数据使用声明

本扩展不收集、不传输、不出售、不共享用户数据，不使用分析、广告、跟踪或远程处理服务。聊天内容和剪贴板内容只在用户本机完成一次性转换。

## 本次更新说明

0.1.6 修复表格结束边界。已确认的 Markdown 管道表格后会保留一个必要空行，避免飞书把表格后的正文继续识别为表格内容。

## 提交备注

测试账号不是必需项。扩展只需要访问公开的 ChatGPT 页面结构，并在用户能看到助手回复时显示按钮。
