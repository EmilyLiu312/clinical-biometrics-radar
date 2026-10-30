# Clinical Biometrics Radar

临床试验 biometrics 情报看板 —— 每天自动汇总 **FDA / ICH / EMA 指南**、**CDISC 数据标准**（SDTMIG / ADaMIG / Define-XML / CORE）、**统计编程行业信号**，每条都替读者判断一次：**要不要动手**。

**在线预览** → https://emilyliu312.github.io/clinical-biometrics-radar/

纯静态站点：一个 `index.html` + 一个 `data.json`，无框架、无构建、无后端。

```
┌─────────────────────────────────────────────────────────┐
│  CLINICAL BIOMETRICS · DAILY BRIEF                      │
│  临床试验 Biometrics 情报工作台                          │
│                                                         │
│  25     25      9       4                               │
│  累计   本期    高优先级  30天内截止                      │
├──────────────────────────────────────┬──────────────────┤
│ [全部][FDA与法规][CDISC与标准][行业]  │ 近期关键截止      │
│                                       │ 11月04日 CDISC…  │
│ ● 2026年10月30日 · 收录 25 条          │        还剩5天    │
│ ┌───────────────────────────────────┐ │ 11月10日 CORE…   │
│ │ CDISC与标准   ● 高      10月01日   │ │        还剩11天   │
│ │ ADaM 与 ADaMIG v3.0 进入公开征求…  │ │                  │
│ │ 摘要 2–3 句…                       │ │ 分类分布          │
│ │ ┃ 对统计编程的影响：写动作，不写…   │ │ ████████ 15      │
│ │ 来源 · 标签 · 关注截止 · 查看原文 → │ │ ████ 7           │
│ └───────────────────────────────────┘ │ ██ 3             │
└──────────────────────────────────────┴──────────────────┘
```

## 为什么不是又一个 RSS 阅读器

信息流的问题从来不是"看不到"，而是"看完不知道该干嘛"。所以这个看板的每条记录都强制包含：

- **重要度**：高 / 中 / 低，按"是否影响正在进行的申报"打，不是按"看着重不重要"
- **对统计编程的影响**：一到两句**可执行**的判断。写"建议持续关注"的条目不合格
- **关注截止日**：公开征求意见、会议报名这类有硬时间窗的，自动进右侧倒计时

选材和写作标准写在 [`docs/editorial-guide.md`](docs/editorial-guide.md)，这是整个项目里最值得读的部分——代码谁都能写，判断标准不能。

## 快速开始

```bash
git clone <this-repo> && cd clinical-biometrics-radar

# 本地预览（必须走 HTTP，直接双击 index.html 会被浏览器拦截 fetch）
python3 -m http.server 8000
# 打开 http://localhost:8000
```

部署到 GitHub Pages：仓库 Settings → Pages → Source 选 **GitHub Actions**，推一次 main 即可。`.github/workflows/deploy.yml` 会自动校验 `data.json` 并发布。

> 仓库里自带的 `data.json` 是 25 条真实条目（2026-10-30 收录），用来让页面一打开就有东西看。想清空重来，把 `data.json` 改成 `{"updated": "", "items": []}` 即可，页面会自动进空状态。

## 目录

```
.
├── index.html              # 整个前端，单文件，CSS 变量在顶部
├── data.json               # 唯一的数据源
├── scripts/merge_items.py  # 校验 + 去重 + 排序
├── tests/                  # jsdom headless 测试（渲染 / 降级）
├── docs/editorial-guide.md # 选材与写作标准
└── .github/workflows/
    ├── deploy.yml          # 校验 → 发布 GitHub Pages
    └── ingest.yml          # inbox.json → data.json → 提交
```

改页面只需要动 `index.html` 一个文件，没有构建步骤，没有依赖。

## 数据怎么进来

```
   搜索 + 判断                入库卫生                展示
┌──────────────┐      ┌──────────────────┐      ┌──────────┐
│ agent / 人工  │ ───> │ merge_items.py   │ ───> │ data.json│ ───> 页面
│ 产出原始条目   │      │ 校验·去重·排序    │      │          │
└──────────────┘      └──────────────────┘      └──────────┘
   inbox.json
```

**上游（搜索 + 判断）刻意不内置。** 它需要能联网检索、读得懂监管文本、还能做编辑取舍的 agent——这一步用 LLM 硬编码出来的效果通常不如人工过一遍。你可以：

- 用任意能联网的 agent（例如配套的 `clinical-biometrics-radar` skill）每天产出 `inbox.json`
- 或者自己读完新闻手写几条

**下游（入库卫生）全部脚本化**，不依赖人的自觉：

```bash
cp inbox.example.json inbox.json     # 按格式填几条
python3 scripts/merge_items.py       # 校验 + 去重 + 排序 + 写回
python3 scripts/merge_items.py --check   # 只校验，CI 里用
```

推到仓库里的 `inbox.json` 会自动触发 `.github/workflows/ingest.yml` 合并并提交。

## 测试

页面最容易坏的地方不是布局，是三件很闷的事：日期算成 `NaN`、原文链接被吞掉、数据为空时整页白屏。所以这里带了两个 headless 测试：

```bash
npm install          # 只装 jsdom 一个 dev 依赖
npm test
```

- `tests/render.test.js`：用 jsdom 真跑一遍页面，断言卡片数、每条原文链接的 `href` 都是 http(s)、截止日全部是「X月X日」格式、可见文本里没有 `NaN`、分类筛选点下去确实变少
- `tests/degrade.test.js`：把 `items` 置空、把 `fetch` 打成 404、把网络打挂，三种情况都必须给出可读提示而不是白屏

改过 `index.html` 之后跑一遍，比肉眼检查可靠。

## 数据结构

`data.json`：

```json
{
  "updated": "2026-10-30",
  "items": [
    {
      "title": "ADaM 与 ADaMIG v3.0 进入公开征求意见（窗口至 11/30）",
      "category": "CDISC与标准",
      "importance": "高",
      "summary": "CDISC 标准路线图显示…（2–3 句）",
      "impact": "建议本月内组织一次内部评审…（1–2 句，写动作）",
      "source": "CDISC Standards Development Roadmap",
      "url": "https://www.cdisc.org/standards/timeline",
      "tags": ["ADaM", "public review"],
      "published": "2026-10-01",
      "deadline": "2026-11-30",
      "collected": "2026-10-30"
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✓ | 一句话说清发生了什么 |
| `category` | ✓ | `AI产品动态` / `FDA与法规` / `CDISC与标准` / `行业与会议` |
| `importance` | ✓ | `高` / `中` / `低` |
| `summary` | ✓ | 2–3 句，说清谁发的、发了什么、关键日期 |
| `impact` | ✓ | 1–2 句，写动作 |
| `source` | ✓ | 机构名 |
| `url` | ✓ | 必须是可打开的 http(s) 链接 |
| `tags` | | 字符串数组 |
| `published` | ✓ | `YYYY-MM-DD` |
| `deadline` | | `YYYY-MM-DD`，有硬时间窗才填 |
| `collected` | | 缺省为入库当天，页面按它分「期」 |

`merge_items.py` 会逐条校验，字段缺失、枚举越界、URL 非法都会明确报错并**拒绝写入**（退出码 2）。

## 定制

| 想改什么 | 改哪里 |
|---|---|
| 隐藏某个分类 | `index.html` 里的 `HIDDEN_CATS`，例如 `{ 'AI产品动态': 1 }` |
| 加分类 | `index.html` 的 `CAT_COLOR` / `CAT_CLASS` + `merge_items.py` 的 `CATEGORIES` |
| 改配色/排版 | `index.html` 的 `<style>`，全部 CSS 变量集中在顶部 |
| 改标题 | `index.html` 的 `<title>` 和 `<h1>` |
| 保留条数上限 | `merge_items.py --max 500` |

## 已知取舍

- **没有实时更新**。数据是 `data.json`，改了才变。要"每天自动更新"，靠的是外部定时任务往仓库推 `inbox.json`，而不是页面自己拉。
- **没有搜索后端**。搜索是前端对当前数据做字符串匹配，几百条内没问题，上千条该换方案。
- **没有多用户权限**。这是单人看板；团队共用就 fork 一份，各推各的。
- **条目是二次加工**。摘要和判断都经过编辑，关键结论请点原文核对。

## License

MIT，见 [LICENSE](LICENSE)。示例数据里的条目全部来自 FDA、CDISC、ICH 等机构的公开信息，版权归原机构所有。
