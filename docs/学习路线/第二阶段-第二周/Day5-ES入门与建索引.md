# Day 5｜ES 入门：倒排索引、分词、mapping

> ⏱ 约 4 小时
> 🎯 产出：一个能搜中文的 question 索引 + 5 条能跑的 DSL
> ✅ 验收：搜"虚拟机"能命中"什么是 JVM"

今天基本不写 Java，全部在 ES 里练。**先把 ES 用熟，明天写代码才不会瞎猜。**

---

## 步骤 1｜先想 5 分钟

上周你给题目加了 `tag` 筛选，用的是 `like '%Java%'`。

问题：

1. 左模糊用不上索引，数据一多就全表扫
2. `like` 只能"包含"，不能"相关度排序"
3. 搜"虚拟机"找不到"JVM"（同义词、分词）

**ES 解决的就是这三件事。**

---

## 步骤 2｜倒排索引（20 分钟）

MySQL 的索引是"正排"：`id → 这一行的内容`。
ES 的索引是"倒排"：`词 → 包含这个词的文档 id 列表`。

拿三道题举例：

| 文档 | title |
|---|---|
| 1 | 什么是 JVM |
| 2 | JVM 的内存结构 |
| 3 | Java 垃圾回收 |

分词后建倒排表：

| 词 | 文档 id |
|---|---|
| 什么 | 1 |
| JVM | 1, 2 |
| 内存 | 2 |
| 结构 | 2 |
| Java | 3 |
| 垃圾 | 3 |
| 回收 | 3 |

搜 "JVM" → 直接查表拿到 `[1, 2]`，O(1) 定位，还能按词频打分排序。

**这就是为什么 ES 快，也是为什么它必须分词。**

---

## 步骤 3｜概念对照（10 分钟）

| MySQL | Elasticsearch |
|---|---|
| 数据库 database | 索引 index |
| 表 table | （也是索引，ES 没有表的概念） |
| 行 row | 文档 document |
| 列 column | 字段 field |
| 表结构 DDL | mapping |
| SQL | DSL（JSON） |

记住一句话：**ES 是"面向文档"的，一个 JSON 就是一条记录，不需要先定义所有列。**

---

## 步骤 4｜分词器实验（30 分钟）

先看默认分词器对中文做了什么：

```powershell
curl.exe -X POST "http://localhost:9200/_analyze" -H "Content-Type: application/json" -d "{\"analyzer\":\"standard\",\"text\":\"什么是JVM\"}"
```

你会看到中文被拆成单个字——这就是"搜不准"的根源。

再看 IK 的两种模式：

```powershell
curl.exe -X POST "http://localhost:9200/_analyze" -H "Content-Type: application/json" -d "{\"analyzer\":\"ik_max_word\",\"text\":\"JVM的内存结构\"}"
curl.exe -X POST "http://localhost:9200/_analyze" -H "Content-Type: application/json" -d "{\"analyzer\":\"ik_smart\",\"text\":\"JVM的内存结构\"}"
```

| 分词器 | 特点 | 用在哪 |
|---|---|---|
| `ik_max_word` | 最细粒度，`JVM`/`内存`/`内存结构` 都切 | **建索引时**（召回率高） |
| `ik_smart` | 粗粒度，只切最合理的 | **搜索时**（准确率高） |

所以 mapping 里写的是 `"analyzer": "ik_max_word", "search_analyzer": "ik_smart"` —— **存的时候多切，查的时候少切**。这是 ES 的经典配置。

---

## 步骤 5｜读懂 mapping（25 分钟）

打开 `sql/post_es_mapping.json`（名字骗人，这是题目的 mapping），重点看三处：

```json
"title": {
  "type": "text",
  "analyzer": "ik_max_word",
  "search_analyzer": "ik_smart",
  "fields": {
    "keyword": { "type": "keyword", "ignore_above": 256 }
  }
}
```

- `text`：会分词，用于全文检索（`match` 查询）
- `keyword`：不分词，整串存储，用于精确匹配和聚合（`term` 查询）
- `fields.keyword`：一个字段两种类型，既能全文搜，又能精确匹配

再看 `tags`：

```json
"tags": { "type": "keyword" }
```

**为什么是 keyword 不是 text？** 因为标签是"精确值"——`Java` 就是 `Java`，不能被切成 `java`、`ja`、`va`。用 text 会导致 `term` 查询查不到。

这是新手最容易配错的地方，记进笔记。

---

## 步骤 6｜灌两条数据，跑 5 条 DSL（60 分钟）

### 6.1 准备数据文件

在 `mianshiya-next-backend` 下新建 `sql/test_q1.json`（UTF-8 编码）：

```json
{
  "title": "什么是 JVM？",
  "content": "请简述 Java 虚拟机的作用",
  "answer": "JVM 是 Java 程序的运行环境",
  "tags": ["Java", "JVM"],
  "userId": 1,
  "isDelete": 0,
  "createTime": "2026-11-01 10:00:00"
}
```

再建 `sql/test_q2.json`，标题改成"JVM 的内存结构"，tags 用 `["Java"]`。

> 为什么用文件而不是直接 `-d "{\"title\":\"中文\"}"`？Windows 下命令行传中文极易乱码，文件最稳。

### 6.2 写进 ES

```powershell
curl.exe -X POST "http://localhost:9200/question/_doc/1" -H "Content-Type: application/json" -d "@sql/test_q1.json"
curl.exe -X POST "http://localhost:9200/question/_doc/2" -H "Content-Type: application/json" -d "@sql/test_q2.json"
```

### 6.3 五条必练 DSL

**① match：全文检索**

```powershell
curl.exe -X GET "http://localhost:9200/question/_search?pretty" -H "Content-Type: application/json" -d "{\"query\":{\"match\":{\"title\":\"虚拟机\"}}}"
```

能命中第 1 条，因为 `JVM` 和 `虚拟机` 都在它的分词结果里（取决于 IK 词典）。

**② term：精确匹配（用于 keyword）**

```powershell
curl.exe -X GET "http://localhost:9200/question/_search?pretty" -H "Content-Type: application/json" -d "{\"query\":{\"term\":{\"tags\":\"Java\"}}}"
```

**③ bool：组合查询（最重要）**

```powershell
curl.exe -X GET "http://localhost:9200/question/_search?pretty" -H "Content-Type: application/json" -d "{\"query\":{\"bool\":{\"filter\":[{\"term\":{\"isDelete\":0}}],\"should\":[{\"match\":{\"title\":\"JVM\"}},{\"match\":{\"content\":\"JVM\"}}],\"minimum_should_match\":1}}}"
```

**④ sort + 分页**

```powershell
curl.exe -X GET "http://localhost:9200/question/_search?pretty" -H "Content-Type: application/json" -d "{\"query\":{\"match_all\":{}},\"sort\":[{\"createTime\":{\"order\":\"desc\"}}],\"from\":0,\"size\":10}"
```

**⑤ 看打分**

搜完之后看返回里的 `_score`，理解"相关度"是怎么来的。

### must / should / filter 的区别（必背）

| 关键字 | 是否参与打分 | 是否缓存 | 语义 |
|---|---|---|---|
| `must` | 是 | 否 | 必须匹配，影响排序 |
| `filter` | **否** | **是** | 必须匹配，不影响排序（更快） |
| `should` | 是 | 否 | 应该匹配，配合 `minimum_should_match` |
| `must_not` | 否 | 是 | 必须不匹配 |

**经验法则**：能用 filter 就用 filter（状态、id、删除标记这类不需要打分的条件）。

---

## 步骤 7｜两个容易被忽略的特性（20 分钟）

### 近实时（NRT）

写入后**默认 1 秒**才能被搜到（`refresh_interval`）。

所以"写完立刻查"查不到是正常的，别以为是 bug。要立刻可见就 `?refresh=true`（生产别用，性能差）。

### 深分页

`from + size` 默认上限 10000。翻到第 1000 页会报错。

真实项目用 `search_after` 或 `scroll`。**本周不用会，知道有这回事就行**——面试问到"ES 深分页怎么解决"能答上，就够了。

---

## 步骤 8｜闭卷（20 分钟）

不看笔记，手写一条 DSL：

> 查询未删除的、标签包含 "Java" 的题目，标题或内容匹配 "JVM"，按创建时间倒序，取前 10 条。

写完用 curl 跑一遍验证。

---

## 卡住了看这里

| 现象 | 原因 | 解决 |
|---|---|---|
| 搜中文没结果 | 用了 standard 分词 | 确认 mapping 里是 ik |
| `term` 查 tags 查不到 | 字段被建成 text | 重建索引，tags 用 keyword |
| 刚写入搜不到 | 近实时，1 秒后才可见 | 等 1 秒，或加 `?refresh=true` |
| 中文乱码 | 命令行传参 | 改用 `-d @文件.json` |
| `index_not_found` | 别名没建 | 重做 Day1 步骤 5 |

---

## 今日自测

1. 倒排索引和 B+ 树索引的本质区别是什么？
2. `text` 和 `keyword` 分别什么时候用？
3. 为什么建索引用 `ik_max_word`、搜索用 `ik_smart`？
4. `filter` 为什么比 `must` 快？
5. 为什么刚写入的数据搜不到？

---

## 明天

把今天的 DSL 翻译成 Java 代码——这才是你项目里真正要交付的东西。
