# ChatGPT 飞书文档复制

这是一个 Chrome 和 Edge 浏览器插件。它在 ChatGPT 官方复制按钮旁增加一个小按钮，点击后复制适合粘贴到飞书文档的内容，不影响官方复制按钮。

粘贴到飞书文档后，可以识别标题层级、段落、列表、引用、行内公式、行间公式、表格、超链接、粗体、斜体和删除线。

## 安装

1. 在 [GitHub Releases](https://github.com/Sven-LI-sankyuu/ChatGPT-Feishu-Lark-Doc-Copy/releases/latest) 下载最新 ZIP。
2. 打开 Chrome 的 `chrome://extensions/` 或 Edge 的 `edge://extensions/`。
3. 开启右上角“开发者模式”。
4. 将 ZIP 拖入扩展程序页面安装。
5. 刷新 ChatGPT 页面。

如果当前浏览器拒绝安装 ZIP，请将它解压，点击“加载已解压的扩展程序”，再选择内部包含 `manifest.json` 的目录。插件上架 Chrome Web Store 后会提供商店安装方式。

## 使用

每条 ChatGPT 回复的官方复制按钮右侧会出现一个与官方图标对比度接近的小按钮。悬停时显示“复制飞书文档版”，点击成功后显示“已复制飞书文档版, 去粘贴吧~”。复制结果默认使用紧凑排版，不在段落之间加入会被飞书显示为空白段落的空行。

## 已知限制

- 行间公式可以被飞书识别，但需要手动居中。
- 粗斜体组合和行内代码在不同飞书样本中的识别结果不一致。

## 开发

需要 Node.js 20 或更新版本。

| 命令 | 作用 |
|---|---|
| `npm install` | 安装依赖 |
| `npm test` | 运行自动测试 |
| `npm run test:extension` | 在 Chromium 中测试插件和剪贴板 |
| `npm run package` | 生成版本化 ZIP |
| `npm run dev:chatgpt` | 加载本地插件并打开 ChatGPT |

`npm run build` 生成可通过开发者模式加载的 `dist/unpacked` 目录。首次运行浏览器测试前，需要执行 `npm run browser:install`。

## 隐私与开源

所有转换都在当前页面本地完成，不上传聊天内容，不加载远程代码。

项目参考了 MIT 协议项目 [BigCatNotFat/chatgpt-feishu-formula-copy](https://github.com/BigCatNotFat/chatgpt-feishu-formula-copy) 的公式提取思路，并重新实现了独立按钮和完整内容转换。许可与致谢见 [LICENSE](LICENSE) 和 [NOTICE.md](NOTICE.md)，开发设计见 [docs/Principle.md](docs/Principle.md)。
