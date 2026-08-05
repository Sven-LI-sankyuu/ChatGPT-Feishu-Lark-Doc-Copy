# 第三方来源说明

本项目参考了以下 MIT 协议项目：

- 项目：`BigCatNotFat/chatgpt-feishu-formula-copy`
- 地址：<https://github.com/BigCatNotFat/chatgpt-feishu-formula-copy>
- 原作者版权：Copyright (c) 2026 BigCatNotFat
- 许可证：MIT License

参考内容包括从 KaTeX 与 MathJax 节点读取原始 TeX 的思路、ChatGPT 运行域名和无远程代码的基础扩展结构。

本项目加入的主要设计包括：在官方复制按钮旁提供独立按钮，不重写剪贴板方法，不拦截页面复制事件；输出飞书实测可解析的结构化 Markdown；保留标题、段落、强调、列表、引用、代码、表格和安全链接地址；增加完整回复范围绑定、动态页面去重、主题适配、成功与错误状态，以及相应的自动测试。

完整 MIT 许可文本见项目根目录的 `LICENSE`。
