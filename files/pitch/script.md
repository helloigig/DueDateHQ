# DueDateHQ Pitch · 讲稿

> 给你（presenter）的全文讲稿。每一张 slide 配上要讲的话、停顿点、过渡。
> 配套：`deck.html`（视觉，给观众看）。
>
> **目标时长**：12 分钟（~40 秒/slide）。
> **核心原则**：deck 卖产品想法，讲稿支撑你「为什么这是 Tier 1 的设计决策」。
>
> **整场 3 个隐形目标**（评委带走）：
> 1. 这个产品有真实的客户访谈撑着（不是凭空想象）。
> 2. 这个产品已经在线、能打开（不是 PPT prototype）。
> 3. 这个产品有架构纪律（DB CHECK 约束、forever-no list）。

---

## Slide 01 · 封面（10 秒）

**Cue**：站定，等观众安静。一句话开场。

> 「我是 Gigi，今天讲的是 DueDateHQ —— CPA 的客户智能层。
> 12 分钟，我会讲清楚为什么这个产品该被造、研究怎么进的、产品决策怎么做的。」

**过渡**：「先看一个具体的周二下午发生了什么。」

---

## Slide 02 · 场景（60 秒）

**Cue**：让 timestamps 和 alert card 自己讲，不要叙事化。三个时间戳读出来即可。

> 「下午 3:14，路易斯安那州税务局发布了飓风延期公告。
> 下午 5:08，Sarah 在午餐结束回到办公室，第一个客户的邮件已经到了——『这对我有什么影响？』
> 晚上 8:30，她还在 Excel 里手动比对她 49 个客户的州。」

**[停顿 1 秒]**

> 「Sarah 是 solo CPA。49 个客户、6 个州、Excel 追 deadline、Gmail 沟通客户。没有任何工具告诉她——这次延期影响她哪 6 个客户、要做什么、邮件怎么写。」

**[强调慢读]**

> 「**她从客户那儿得知政策变化。每一次都是。**」

**[停顿 2 秒，让句子落下]**

**过渡**：「这不是孤立事件。这是三件事每天压在她身上里的一件。」

---

## Slide 03 · 痛点（75 秒）

**Cue**：按红框（真实代价）顺序读，不要读 body 段落。让钱和后果说话。

> 「**痛点 1 · State Alerts**：客户先知道。CPA 道歉，有时候自己赔。一次 $500-$2,000。」

**[指右边卡片]**

> 「**痛点 2 · Task Management**：漏一个 deadline = 客户走人 + 下一年职业责任险涨 15-30%。300 多个 deadline 跨州，Excel 追不过来。」

> 「**痛点 3 · File Request**：3 周前开始追，最后一周客户的 1099 才到。3-4 个周末都在加班——这不是工作量问题，是生活问题。」

**[停顿，转到长期痛点]**

> 「这些是日常痛。还有一个长期的—— **partner 退休，事务所价值掉一半**。客户 5 年的 pattern 全在 partner 脑子里：哪家基金的 K-1 总是 8 月才到、谁去年漏报了 Schedule E、哪个客户必须提早问。partner 走，知识全丢。」

**过渡**：「这一行没人解决。我们看了竞争，确认了这一点。」

---

## Slide 04 · 竞争（45 秒）

**Cue**：先指威胁等级行（顶部），再快速读 6 行差异。最后一句是定位陈述。

> 「5 家主要对手。最右那列 File In Time 是 H 威胁——30 年老厂、$199 一次性买断、CPA 们已经习惯。但它是 Windows 安装包，没法做云端 24h SLA。」

> 「TaxDome 和 Karbon 是 M 威胁——他们做全套，我们只做层。Canopy 是 L——~$2.4 亿 VC 但路线已经向 all-in-one 平台收敛，不会做我们这种 specialist。」

**[手指最后一行]**

> 「最后一行是关键的：**他们做客户 portal、文件 vault、计费——我们永不做**。我们让 QuickBooks / Lacerte / Gmail 各自做各自的事，我们只补一层他们都缺的：客户智能。」

**过渡**：「现在的市场窗口为什么打开了。」

---

## Slide 05 · 机会（60 秒）

**Cue**：左边 Why now 三条；右边 SAM。诚实承认楔子小，立刻反转到平台扩展。

> 「三件事让这个生意现在才成立。」

> 「一—— **LLM 经济**。5 年前 50 州监控 + 客户匹配是 Bloomberg 的数千美元/年订阅生意。现在独立工具能做。」

> 「二—— **老牌在崩**。File In Time 2026 还是 Windows 安装包，结构跟不上。」

> 「三—— **Suite 疲劳**。TaxDome 年付绑定 + 10-15 小时安装。Capterra 每个差评都在喊『我要一个层，不要又一个套件』。」

**[转到右边]**

> 「市场自下而上算：美国 ~45,000 个 solo 到 10 人事务所 × $60/月 = ~$22M ARR 全渗透。**楔子小，我们承认。**」

> 「但平台不小：Y3 我们 ship Layer B 顾问层，价格 $200-500/seat。Y5 firm brain 进中型 firm，$1K-5K/seat。邻接行业 5×。这个生意有路径。」

**过渡**：「那我们到底做什么？」

---

## Slide 06 · 我们做什么（60 秒）

**Cue**：左边 2 句话——慢读，停顿。右边 3 层结构是产品架构。

> 「一个 CPA 能给 10 个客户精细的服务。给 100 个就给不动了。」

**[停顿 1 秒]**

> 「DueDateHQ 把『精细服务』里机器能做的部分—— **跑遍整本客户簿**。」

**[手指底下 5 个 chip]**

> 「五件事：记忆、预测、确认、监控、起草。CPA 留给自己的是判断、签字、关系。」

**[转到右边三层]**

> 「我们的产品有三层结构：
> **楔子是 state alert + 受影响客户匹配**——独有，拿到 demo 的钩子。
> **主体是 chase loop AI + 文件智能**——每天在用的部分，让 Sarah 周末回家。
> **引擎是多年客户历史 import**——切换成本，Year-2 retention 论点。」

**过渡**：「这个产品架构不是凭空想的。它来自一个 660 行的访谈。」

---

## Slide 07 · Yan Jing 深度访谈（90 秒）

**Cue**：左边卡片是 persona 和 quote，右边是 5 条 TL;DR。整页讲法：先 quote 落下，再过 5 条结论。

> 「最重要的访谈是 Yan Jing。15 年合伙人、10 人事务所、600 客户、20 州、国际税方向。整段访谈有录像存档。」

**[读 quote 慢]**

> 「『**600 个客户如果每个人都去问一下的话，那好多时间花在**。』」

**[停 1 秒]**

> 「他间接承认了他记不住所有客户。具体是—— 50 个清楚记得、100 个模糊、剩下 450 个只能查记录。**这是供给侧天花板**。AI 的职责不是替他做事，是让 600 个客户都得到他给前 50 的关注。」

**[转右边]**

> 「访谈跨 4 个问题主线，浓缩成 5 条 TL;DR——每一条都直接落进了产品架构：」

> 「一—— **多年历史不是『慢慢变好』，是壁垒**。Day 1 by import，不是 Year 2 才有。这就是为什么我们在产品文案里禁止『AI is learning』话术。」

> 「二—— **Onboarding 必须分 3 层**。5 分钟 / 30 分钟 / 持续。每一层都见价值，不要『先付一年慢慢学』。」

> 「三—— **AI 优势不是单户精度，是规模**。这是 Lacerte test 的来源——『Lacerte 的滚动复制能给同样的答案吗？如果能，我们没造新东西。』」

> 「四—— **邮件 + 审计轨迹是信任脊梁**。Stage 1 review → Stage 2 opt-in。Timeline 是 IRS 合规要求。」

> 「五—— **最值钱的买家是 preparer 升级到 advisor 的资深合伙人**。Year-3 retention 论点。」

**[结尾框架句]**

> 「他给了我们整段访谈的产品框架——**『AI 不替 CPA 做决定。AI 让 CPA 看到他原本看不到的信息。』** 这一句直接写进了我们的 §5.3 不变量。」

**过渡**：「这 5 条 TL;DR 怎么具体落进产品的？看下一页。」

---

## Slide 08 · Yan Jing 4 个 Q-thread → 决策（75 秒）

**Cue**：4 张卡。每卡 quote 落下，再读决策映射。

> 「访谈是按 4 个问题主线展开的。每个 thread 直接生产一个产品决策——」

> 「**Thread Q1 多年历史**。他说：『为什么我要先付一年费用，然后等 AI 慢慢学？』 → 我们重写了 onboarding 为 3 层，Day 1 import 是引擎，产品文案禁止『AI is learning』。」

> 「**Thread Q2 邮件 + 审计轨迹**。『IRS 来查 client X 的 2023 年报税，事务所必须能调出我们在 T 时刻问了 Y。』 → Stage 1 review → Stage 2 opt-in（满足 3 条件后自动），activity timeline append-only，可导出 PDF + JSON。」

> 「**Thread Q4 双向集成**。『我有 40 个软件工具，最怕新东西不和它们说话。CCH 内核可能 50 年了。』 → Karbon route（layer-not-suite），Tier 0/1/2/3 框架，CCH Axcess 进 forever-no list。」

> 「**综合 · 决策边界**。『AI 不替 CPA 做决定——AI 让 CPA 看到他原本看不到的信息。』 → 绿/黄/红区，§5.3 不变量直接写进 DB CHECK 约束。」

**[底部紫色 callout]**

> 「另外 4 个延展 thread 也都落到了 PRD §6 / §7 / §8 / §13。Year-1 / Year-3 / Year-5 trajectory 由此而来。」

**过渡**：「Yan Jing 是 n=1。我们另做了两次访谈做互补。」

---

## Slide 09 · 另两次访谈 + Questionnaire + 招募 funnel（60 秒）

**Cue**：先指顶部 13 问 questionnaire（说明研究有结构）→ 招募 funnel（说真实付出，30+ DM 无人理这个数字最有说服力）→ L. 和 M. 具体发现。

> 「Yan Jing 之外另两位访谈，结构化的 outreach form——13 个问题，3 个主题：5 个工作流问题、5 个 state alert 问题、3 个转化问题。**这个 form 是独立 web app**，自动保存、迭代了 4 个版本，不是 Google form。」

**[转到 funnel]**

> 「招募 funnel 的真实数字：Discord r/TaxProChannel 1 个响应——L.；LinkedIn cold DM 30 多个，**没人回复**；自有人脉介绍 1 个——M.；外加 Yan Jing 的录像深访。」

**[转到 L. 和 M.]**

> 「**L. 是 solo CPA**，3 年独立、~40 客户。她确认了 Yan Jing 的供给侧框架在小规模也成立。她还告诉我们她试过 TaxDome，第 3 个客户导入就放弃了——『不愿为不需要的 80% 功能绑一年』。这就是为什么我们月付、无年锁。」

> 「**M. 是 5 人事务所的 junior accountant**。她揭示了 Yan Jing 看不到的视角：『不知道自己不知道什么』——partner 把客户『丢』给她，没人系统化记下每个客户去年怎么处理的。这条直接把 Layer C『firm brain』从 P2 升级为 Year-5 retention 关键路径。」

**过渡**：「这些访谈给我们的不是『做什么功能』，是『我们错在哪』。」

---

## Slide 10 · 洞察（45 秒）

**Cue**：4 条洞察，按编号读。第 4 条放慢——这是和「我们用 AI」最大的区别。

> 「研究给了我们 4 条战略洞察——」

> 「**01 瓶颈是供给侧，不是质量分层**。同行假设 CPA 选哪些客户得到精细服务。错。CPA 不选——是没时间。」

> 「**02 楔子是州公告，壁垒是多年历史**。州公告独有 → 拿到 demo。多年客户历史 → 切换成本指数级增长。两件事都得做，但顺序不能错。」

> 「**03 做层，不做套件**。Yan Jing 40 个工具，最怕新东西不和它们说话。我们和 QuickBooks / Lacerte / Gmail 共生，永不替。」

**[放慢]**

> 「**04 信任建在数据库，不在文案**。『AI 越用越懂你』是销售失败话术。§5.3 不变量『AI 永不自动确认材料齐』直接写进 DB 的 CHECK 约束里——**客户可以查代码**。」

**过渡**：「这套架构变成了一个真实的 dashboard。Sarah 周一早上看到的样子——」

---

## Slide 11 · 解决方案 + Demo（75 秒）

**Cue**：mockup 是真实产品的复刻。讲完 mockup 内容后立刻打开 duedatehq.space/today。

> 「Sarah 周一早上打开 dashboard。**State alert 条只在有可执行内容时出现**——不是天天都看到。」

**[指 alert]**

> 「LA 飓风延期，6 个客户受影响，8 个 deadline 待延期，6 封邮件已用她的语气起草。一键查看 / 批量延期 / 转发原文。」

**[转到 Action Queue]**

> 「下面是 Action Queue。9 种 AI 来源——Mode A、C、D、F、入站邮件意图、bounce、手动等等——**压缩成 4 个动词**：发送、确认、应用、讨论。」

> 「Emily Chen，W-2 比她往年的 pattern 晚 7 天，建议发温和的确认；Apex Capital K-1 截止前 21 天，材料只齐 30%；Marcus 的银行流水有 2 处异常；Ridgewood 连续 5 年的 Schedule E 今年缺失——这一条最有意思。」

**[转到底部黑色 CTA strip]**

> 「这不是 mockup。**现在就可以打开 duedatehq.space/today 看**。22 个页面、83 个组件、~63K 行 TypeScript、Hono + tRPC + Drizzle + Supabase。」

**过渡**：「信任不是文案问题，是架构问题。」

---

## Slide 12 · AI 层（60 秒）

**Cue**：3 个 zone 快速过；§5.3 不变量代码块——读 ALTER TABLE 那句要慢。

> 「我们的 AI 在 3 个区域里工作——」

> 「**绿区**：AI 直接做。入站邮件路由、提醒邮件起草。CPA 可随时回滚。」

> 「**黄区**：AI 提议、CPA 审。出站、改状态、改钱——必过人手。」

> 「**红区**：AI 永不开口。税务建议、audit 风险、法规解读——CPA 的法律责任，AI 不沾。」

**[指代码块]**

> 「§5.3 不变量『AI 永不自动确认材料齐』直接写在 DB 层。」

**[慢读]**

> 「`ALTER TABLE checklist_item ADD CONSTRAINT human_must_confirm CHECK ( state != 'received_confirmed' OR confirmed_by_user_id IS NOT NULL );`」

> 「客户问『AI 会不会替我犯错』，我们答：**不会，因为它在数据库层就被禁止了**。这不是文案，是约束。」

**过渡**：「不止 DB 约束。整个工程实施有更多卖点。」

---

## Slide 13 · 技术实施 · 工程深度（60 秒）

**Cue**：这一页是给评委看「我们不是 vibes 产品」。先讲左边管线，再过右边 5 个工程决策。

> 「我们的 state alert 管线——」

> 「50 个州 DOR 网站每 15 分钟轮询，content hash 去重；LLM 解析器提取 12 个结构化字段 + 置信度；置信度低于 0.85 进入人工审核队列；Matcher 做 per-firm 客户簿交叉；最后 4 个 alert surface 配 Resend 发邮件。」

**[转右边 5 条]**

> 「右边 5 个工程决策，每一条都不是装饰——」

> 「**01** §5.3 不变量在 DB CHECK 约束里。」
> 「**02** Postgres Row-Level Security 多租户——应用层 + DB 双层隔离。」
> 「**03** 双层 AI 置信度——parse 和 match 分开，不是一个数字。」
> 「**04** Anthropic + OpenAI 双 LLM 兜底。每 firm 月度成本 cap $50。」
> 「**05** Activity timeline append-only——IRS audit-grade，5 分钟出包。」

**过渡**：「具体功能怎么映射到这 5 件 AI 接管的事？」

---

## Slide 14 · 产品特性（45 秒）

**Cue**：表格按行读，不要竖着读。强调 Day 1 / P1 节奏。

> 「5 件机器接管的事，每一件都有对应的 Mode、Day 1 / P1 节奏、解决的痛点、关键功能。」

> 「**记忆 (A+E)** 解决『上次怎么处理这个客户的我忘了』；**预测 (B)** 是 P1，对应 Yan Jing 的『不能 1 月 1 号就开始问』；**确认 (C)** 是 Day 1，§5.3 不变量；**监控 (F)** 是 50 州 24h SLA；**起草 (D)** Day 1，CPA 自己语气加来源引用。」

**过渡**：「这些 AI 能力背后是集成。」

---

## Slide 15 · 集成（30 秒）

**Cue**：4 个 tier 顶部色条区分。强调最右——「永不做」。

> 「Tier 0 是 Day 1 必装：QBO、Xero、Gmail、Outlook——没这层产品就退化成『楔子 + 手动』。」

> 「Tier 1 P1 单向：Bloomberg / CCH 流入、SharePoint / CRM 流出、报税软件历年导入——这是引擎钥匙。」

> 「Tier 2 是 PDF 兜底。**Tier 3 永不做**：CCH Axcess、付款、银行——内核 50 年了无 API，付款进 PCI 陷阱。**集成态度即定位**。」

**过渡**：「现状——」

---

## Slide 16 · 现状（30 秒）

**Cue**：4 个数字 + 10 行 shipped feature 列表。强调"在线"两个字。

> 「**这些都在 duedatehq.space 上跑**。50 州监控管线 24h SLA、4 个 alert 通道、Action Queue、Client fleet、Multi-state apply wizard、7 步 onboarding、公开的 /changes 历档。22 个页面、83 个组件、~63K 行 TypeScript。」

**过渡**：「接下来 12 个月——」

---

## Slide 17 · Roadmap（45 秒）

**Cue**：4 个 phase 顶部色条。每个 phase 强调 1-2 个最强 feature，不要全念。

> 「**现在 May 2026**：楔子完整，dashboard 上线。」

> 「**Q3 2026 商业化**：Gmail/Outlook 登录、QBO/Xero 双向 sync、Stripe 计费 + 三档 plan 上线（$29 / $49 / $99）。第一笔付费收入。」

> 「**Q4 2026 日常 AI**：把 AI 接进每一个 chase loop——AI 邮件起草、AI 入站异常检测、AI 自动 checklist、每日邮件 digest。**Yan Jing 付钱那一刻**。」

> 「**明年 Q1+ 引擎 + 平台**：多年导入、per-client 时机预测、顾问触发、SOC 2、公开 API、Layer C firm brain。Year-2 retention 论点开始生效。」

**过渡**：「最后——『不做』也定义『做』。」

---

## Slide 18 · 永不做 + 评委带走的 4 件（60 秒）

**Cue**：左边 forever-no 快读；右边 4 件是 closing punchline——慢读，最后那句『现在就可以打开 duedatehq.space』是最后一句。

> 「左边——我们永不做：客户 portal（TaxDome 已占）、文件 vault（SharePoint 已经在）、计费（Stripe + CPACharge 已占）、时间记录、报税本身、audit 风险预测、CCH Axcess。**说『永不做』和说『做』一样重要**。」

**[转右边 4 件，每件读慢]**

> 「评委今天带走的 4 件——同 brief 同 demo day 上对手大概率没有的——」

> 「**01 他写了我们一半的 PRD**。660 行 Yan Jing 录像访谈，57 条 traceable 决策，2 段非录像访谈，透明的招募 funnel。」

> 「**02 『Solve this one pain — and I'm definitely your first customer』**。Yan Jing 标准承诺，600 客户、10 人事务所，不是销售线索是 commitment。」

> 「**03 信任直写在 DB CHECK 约束里——客户可以查代码**。§5.3 不变量。不是文案是约束。」

**[最后一句最慢]**

> 「**04 现在就可以打开 duedatehq.space**。22 个页面、83 个组件、~63K 行、真实用户在试用。**不是 prototype，是 production**。」

**[停 2 秒，让最后一句落下]**

> 「谢谢。」

---

## 时长检查

| Section | 累计时长 |
|---|---|
| 01–05（开场 + 痛点 + 机会） | 4:10 |
| 06（我们做什么） | 5:10 |
| 07–10（研究 + 洞察） | 9:00 |
| 11–13（产品 + 技术） | 12:15 |
| 14–17（特性 + 集成 + 现状 + roadmap） | 14:45 |
| 18（closing） | **15:45** |

> 实际目标 12-13 分钟。如果超时，最容易压缩的是：08（Q-thread）压到 60 秒，09（另两次访谈）压到 45 秒，14（特性）压到 30 秒。

---

## Q&A 准备 · 评委可能问的 5 个问题

### 1. "TAM 才 $22M，这怎么是 venture-scale？"
> 楔子是 $22M。但平台路径明确：Y3 Layer B 顾问层把价格抬到 $200-500/seat（5×）；Y5 firm brain 进中型 firm $1K-5K/seat（再 5-10×）；邻接行业（bookkeeper / EA / fractional CFO）同一架构 5× firm 数。我们用 SAM 跑前 18 个月，用 Layer B/C 跑后面。

### 2. "你怎么 defend 这个产品不被 Karbon 吞掉？"
> Karbon 是 H 威胁但不是这个 specific 楔子。原因：他们的产品 P&L 不允许 $49/seat 的 SLA-driven specialist。他们 2026 推 AI agents 是横向加 feature，不是把 50 州监控做到 24h SLA。我们的防御不是技术，是 product P&L 的对立——Karbon 做我们的事会损害他们 $59/seat 的 all-in-one 定位。

### 3. "Yan Jing 是 n=1。怎么不是 selection bias？"
> 三件事：(1) L. 在 40 客户级别独立验证了同样的 chase loop 痛和供给侧框架。(2) M. 揭示了 Yan Jing 看不到的小事务所 junior 视角，给 Year-5 retention 论点。(3) PRD §0.5 是 57-row traceability table，每一条产品决策可以追到具体访谈引述——所以 selection bias 在 traceability 上是可验证的。

### 4. "tech stack 这么深，6 周内做完吗？"
> Dashboard 已经 ship——22 页 / 83 组件 / ~63K 行 / 4 alert 通道在生产。State 管线在跑。剩下的 Q3-Q4 是把 AI Mode A+C+D 接进现有的 ChecklistItem state machine。基础设施都在了，wire-up 工作。

### 5. "Forever-no 这么多东西不做，怎么和 TaxDome 抢客户？"
> 我们不抢 TaxDome 的客户。我们抢 Excel 的客户——50% 以上的 solo CPA 还在用 Excel + Outlook。TaxDome 客户 churn 出来时，我们是 layer，他们 keep 现有 Lacerte / QBO 也行。我们和 TaxDome 不是替代关系，是不同 segment。

---

## 红线 · 不要说的话

- ❌ "Your AI will get smarter as it learns" — 销售失败话术，明令禁止。
- ❌ "We're disrupting the $40B accounting software market" — 顶向下 TAM 是 tell。
- ❌ "We use AI to..." — 每个 pitch 都说，无信号。
- ❌ "We're like Karbon for state alerts" — 类比不准，CPA 知道 Karbon 不做 state alerts。
- ❌ 在演示时承诺 unshipped feature。Roadmap-skepticism 在 CPA 圈里是真实的。

---

## Source · 这份讲稿来源于

- `Interview Notes — 15-Year CPA Founder.rtf`（660 行 Yan Jing 综合）
- `cpa-research-outreach-final.html`（13-Q outreach form）
- `INTERVIEWEE-ASK.md`（5-Q lite 版）
- `USER-INTERVIEW-GUIDE.md`（招募方法）
- `_archive/bootcamp-artifacts/02-user-research-playbook.md`（Tier 1/2/3 框架）
- `strategy-01-positioning.md`（Moore + Dunford + Neumeier 定位）
- `strategy-02-problem-statement.md`（Loop A/B/C 严重性）
- `strategy-03-customer-journey.md`（3 personas × 8 stages）
- `competitive-analysis.html`（threat ratings + funding data）
- `STATE-NOTIFICATION-IMPLEMENTATION.md`（管线工程细节）
- `BACKEND-IMPLEMENTATION.md`（Postgres + RLS + tRPC）
- PRD v0.8 + IA v0.7 + arch v0.7（canonical specs）

---

*生成时间：2026-05-06 · v1 · 配套 deck.html v18 张*
