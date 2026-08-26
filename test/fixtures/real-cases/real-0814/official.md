你拍到的是 KDD 2026 的一篇 dataset / benchmark paper：

**FinTexTS: Financial Text-Paired Time-Series Dataset via Semantic-Based and Multi-Level Pairing**，来自 LG AI Research 等机构。论文 2026 年 3 月放到 arXiv，核心目标是解决一个很实际的问题：**做金融 multimodal forecasting 时，到底应该把哪些新闻和某只股票的时间序列配在一起？** ([arXiv][1])

我觉得理解这篇 paper 最好的方式，是先别把它看成“又一个股票预测模型”。它主要做的是 **data construction / alignment**。它认为现有金融 text-time-series dataset 的瓶颈之一，其实发生在模型训练之前：**text 和 time series 配错了。**

### 1. 它发现的问题是什么？

假设我们要预测 NVIDIA 的价格。

最简单的数据构造方法是从新闻库里搜：

> NVIDIA / NVDA

然后把包含这些关键词的新闻和 NVDA 当天的 OHLC price pairing。

问题在于，金融市场的信息传播结构远比 keyword matching 复杂。

比如：

> “Philadelphia Semiconductor Index fell sharply after concerns over AI chip demand.”

这篇新闻可能根本没有出现 NVIDIA，但它显然和 NVIDIA 有很强的经济关系。

反过来：

> “The Motley Fool owns shares of Nvidia, Apple, Microsoft…”

虽然出现 NVIDIA，但可能只是文章末尾 disclosure，对 NVDA 几乎没有信息量。

所以作者认为传统 pairing 会同时产生：

[
\text{False Positive}: \quad \text{出现 NVIDIA，但其实不相关}
]

以及

[
\text{False Negative}: \quad \text{没出现 NVIDIA，但实际上高度相关}
]

这就是 poster 右上角那张图想表达的核心 motivation。论文认为应该从 **semantic relevance** 出发做 pairing。([arXiv][1])

---

## 2. FinTexTS 怎么解决这个问题？

整个 pipeline 可以理解成两层。

第一层解决：

> **“这篇新闻和这个公司有没有经济语义上的关系？”**

第二层解决：

> **“如果有关系，它处于什么层次？”**

这就是标题里的 **Semantic-Based + Multi-Level Pairing**。

### Semantic-based pairing

这里有个挺有意思的设计：作者没有简单拿公司名字去做 embedding。

他们先从公司的 **SEC filing** 里提取 company-specific context，包括产品、战略、市场、治理与风险、财务情况、近期事件等信息。

因此对于 NVIDIA，retrieval query 所表达的是类似：

> NVIDIA 是什么公司、卖什么东西、处于什么产业链、面对什么风险、近期有哪些 catalyst……

然后用 embedding model 去新闻库里做 semantic retrieval。论文具体 fine-tune 了 **Linq-Embed-Mistral**，每个 SEC filing component retrieval 10 篇新闻。([ResearchGate][2])

这一步其实是在估计一个：

[
R(n,c)=\operatorname{sim}(E(n),E(C_c))
]

其中 (n) 是 news，(c) 是 target company，(C_c) 是从 filing 提取出来的公司语义 context，(E(\cdot)) 是 embedding encoder。

所以 pairing 从：

[
\text{company name}\leftrightarrow\text{news keyword}
]

变成了：

[
\text{company economic context}\leftrightarrow\text{news semantics}.
]

我认为这是这篇 paper 最重要的一步。

---

## 3. Multi-Level Pairing 更有意思

找到相关信息之后，作者进一步认为：

**不同新闻影响公司的 causal distance 不一样。**

于是用 LLM 把信息组织成四层：

| Level           | 含义   | AMD 的例子              |
| --------------- | ---- | -------------------- |
| Macro           | 宏观环境 | Fed 加息               |
| Sector          | 行业   | semiconductor demand |
| Related Company | 相关公司 | Intel/NVIDIA 的事件     |
| Target Company  | 公司自身 | AMD 与 Microsoft 合作   |

论文使用 GICS 的 11 个 sector 做 sector classification，同时让 LLM 判断新闻属于 macro、sector、related company 或 target company。([arXiv][1])

所以最终一天的数据大致可以理解成：

[
x_t =
(P_t,,
T_t^{macro},,
T_t^{sector},,
T_t^{related},,
T_t^{target})
]

其中 (P_t) 是当天股票数值序列，后面四个 (T) 是不同信息层次的文本。

这其实比简单的“stock + news”数据结构丰富很多。

---

## 4. 为什么 multi-level 很重要？

从金融角度看，这个 intuition 是合理的。

股票收益可以粗略想成：

[
r_{i,t}
=======

\beta_i^\top F_t
+
\gamma_{s(i)}^\top S_t
+
\delta_i^\top C_t
+
\epsilon_{i,t}
]

(F_t) 表示 macro/common factor，(S_t) 表示 sector shock，(C_t) 表示 company-specific information。

FinTexTS 虽然没有直接建立这样一个资产定价模型，但它的数据组织方式其实隐含了类似的 hierarchical information structure：

**Macro → Sector → Related firms → Firm**

这也是为什么我觉得它真正值得关注的地方，并不只是“semantic retrieval 比 keyword retrieval 好”，而是它开始把金融市场里的 **information hierarchy** 显式编码进 multimodal dataset。

Poster 下方的 ablation 也正是在验证这一点：从单层信息逐渐加入其他层级以后，多种 forecasting backbone 的 MSE/MAE 整体下降。例如 DLinear 的 MSE 从只用 macro 信息时的 0.0241 降到四层全部加入后的 0.0219；iTransformer 从 0.0225 降到 0.0213。([ResearchGate][2])

---

## 5. Dataset 本身长什么样？

公开 Hugging Face 数据现在能看到 **约 130,400 rows、100 个 ticker，覆盖 2019-01-01 到 2023-12-29**。([Hugging Face][3])

每条数据除了：

`date / ticker / open / high / low / close`

之外，还有：

`macro_category1...5`

`sector_category1...5`

`relatedCompany_category1...3`

`targetCompany_category1...3`

以及从 filing 提取出的 financial statement、governance/risk、overview/product、strategy/market operations、recent event/catalyst 等字段。([Hugging Face][3])

所以它实际上已经把“原始新闻海洋”加工成了一种比较结构化的 **financial context representation**。

[FinTexTS arXiv 论文](https://arxiv.org/abs/2603.02702?utm_source=chatgpt.com)

[FinTexTS Hugging Face 数据集](https://huggingface.co/datasets/EXAONE-BI/FinTexTS?utm_source=chatgpt.com)

---

## 6. 实验在证明什么？

他们拿了一批经典 forecasting backbone 来测，包括 DLinear、PatchTST、iTransformer、Autoformer、Informer、TSMixer 等，输入 horizon = 64，forecast horizon = 3，价格输入是 OHLC。([ResearchGate][2])

实验主要想支持三个判断：

**第一，semantic pairing 比 keyword pairing 好。**

说明 dataset construction 本身会影响 downstream forecasting。

**第二，多层文本比单层文本好。**

Macro、sector、related company、target company 信息逐步加入以后，预测误差总体继续下降。

**第三，news source quality 很重要。**

他们还拿 proprietary curated news 做了同样 pipeline，结果比 public news dataset 更好。这个结果其实很符合金融数据的经验：文本模型最终性能有相当一部分来自 **information set 的质量**，并不只是模型 architecture。([arXiv][1])

---

## 7. 我觉得这篇 paper 最值得讨论的地方

如果从研究角度看，我会给它一个比较明确的定位：

> **它是在研究 financial multimodal learning 的“measurement / alignment layer”。**

很多工作默认 dataset 中：

[
(\text{news}_t,\text{stock}_t)
]

天然就是一个正确 training pair，然后把精力放在 cross-attention、fusion architecture 或 foundation model 上。

FinTexTS 问了更前面的问题：

[
\boxed{\text{什么文本才应该成为 } x_{i,t}^{text}?}
]

这个问题其实相当 fundamental。

不过它也留下了一个很大的研究空间：**semantic relevance 仍然不等于 price relevance，更不等于 causal relevance。**

比如：

> “AI chip market will grow 30%”

语义上和 NVIDIA 极其相关。

但如果市场一个月前已经 price in，它对今天的：

[
E[r_{NVDA,t+1:t+3}\mid \mathcal I_t]
]

可能几乎没有 incremental information。

因此 FinTexTS 解决的是：

[
\text{Text}\rightarrow\text{Company semantic relevance}
]

而更难、也更接近金融本质的问题其实是：

[
\text{Text}
\rightarrow
\text{new information}
\rightarrow
\text{market expectation update}
\rightarrow
\text{price impact}.
]

这也是我看这个 poster 时觉得最有研究延展性的地方。它已经把 **keyword → semantic** 这一步做了，下一步很自然会走向 **semantic relevance → informational relevance / market impact**。

如果你是想从“这个工作有没有意思、能不能沿着它想一个更强的 paper idea”的角度看，我可以继续从 **KDD reviewer + 金融研究 + multimodal TS** 三个视角拆一下它的 weakness，以及哪些地方比较可能做成下一篇工作。

[1]: https://arxiv.org/abs/2603.02702?utm_source=chatgpt.com "FinTexTS: Financial Text-Paired Time-Series Dataset via Semantic-Based and Multi-Level Pairing"
[2]: https://www.researchgate.net/publication/401523318_FinTexTS_Financial_Text-Paired_Time-Series_Dataset_via_Semantic-Based_and_Multi-Level_Pairing?utm_source=chatgpt.com "(PDF) FinTexTS: Financial Text-Paired Time-Series Dataset via Semantic-Based and Multi-Level Pairing"
[3]: https://huggingface.co/datasets/cb666/FinTexTS?utm_source=chatgpt.com "cb666/FinTexTS · Datasets at Hugging Face"
