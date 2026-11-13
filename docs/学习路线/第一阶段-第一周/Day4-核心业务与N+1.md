# Day 4｜核心业务：分页、动态条件、N+1

> ⏱ 约 3 小时
> 🎯 产出：题目按标签筛选
> ✅ 验收：body 传 `{"tag":"JVM"}` 能筛出对应题目

## 今天的边界

只读 `QuestionServiceImpl`。题库关联的批量操作扫一眼即可，深挖留到第二阶段。

---

## 步骤 1｜读动态查询条件（30 分钟）

打开 `service/impl/QuestionServiceImpl.java`，找到 `getQueryWrapper`（大约 106 行，行号会略有差异）。

逐行看：

- 参数 `QuestionQueryRequest` 里有哪些字段？
- 每个 `if` 判断对应哪个查询条件？
- 为什么这里用 `QueryWrapper<Question>`（字符串列名）而不是 `LambdaQueryWrapper`？
- 排序是怎么处理的？`sortField` 白名单在哪？

记一条方法论：**动态 SQL 的本质是"条件为空就不拼"**。所有 `xxx != null` 的判断都是在做这件事。

---

## 步骤 2｜读分页（25 分钟）

看 `listQuestionByPage`：

```java
Page<Question> questionPage = this.page(new Page<>(current, size), queryWrapper);
```

三个问题：

1. `limit` 是谁加进 SQL 的？（看 `config/MyBatisPlusConfig.java` 的分页插件）
2. `total` 是哪条 SQL 查出来的？
3. 为什么接口要限制 `pageSize` 上限？（爬虫/慢查询）

在控制台看 SQL 日志，你会看到两条 SQL：一条 `select count(*)`，一条带 `limit`。

---

## 步骤 3｜读 VO 组装，找到 N+1（35 分钟）

看 `getQuestionVOPage`（大约 183 行起）：

1. `questionList.stream().map(QuestionVO::objToVo)` 先转 VO
2. `Set<Long> userIdSet` 收集所有 userId
3. `userService.listByIds(userIdSet)` **一次**查完
4. `Collectors.groupingBy(User::getId)` 建成 Map
5. `forEach` 从 Map 里取，填充 VO
6. 题库关联同理（`in("id", questionIdSet)`）

**反例想一下**：如果在 forEach 里写 `userService.getById(userId)`，10 条题目就是 1 + 10 次查询。这就是 N+1。

记一条方法论：**批量查询 + 内存拼装**，是后端最通用的性能套路之一。面试聊性能时，这条比背八股有用。

---

## 步骤 4｜读中间表操作（20 分钟）

打开 `service/impl/QuestionBankQuestionServiceImpl.java`：

- `add`：先校验题库和题目是否存在 → 再查是否已绑定 → 插入
- 为什么"先查再插"还要加唯一索引？（并发下先查再插会漏，唯一索引是最后一道防线）
- 批量绑定用 `saveBatch`，为什么要先去重？
- 事务注解加在哪一层？（Service，不是 Controller）

---

## 步骤 5｜动手：加 tag 筛选（45 分钟）

三步，改三个文件：

### 5.1 `model/dto/question/QuestionQueryRequest.java` 加字段

```java
/**
 * 标签
 */
private String tag;
```

### 5.2 `QuestionServiceImpl.getQueryWrapper` 加条件

```java
String tag = questionQueryRequest.getTag();
queryWrapper.like(StringUtils.isNotBlank(tag), "tags", tag);
```

### 5.3 验证

重启后调 `/api/question/list/page/vo`，Body：

```json
{"tag": "JVM", "pageSize": 5}
```

**验收**：只返回 title 含 JVM 那道题；控制台 SQL 里能看到 `tags like '%JVM%'`。

---

## 步骤 6｜想一个问题：索引为什么没用上（15 分钟）

`question` 表建了 `idx_title`，但 `like '%Java%'` 是**左模糊**，索引失效。

也就是说：题目一多，这个搜索就会全表扫描。

先去 `questions.md` 写下你的猜想（怎么优化？），第二阶段上 Elasticsearch 时再回来验证——**带着问题学，比直接看答案记得牢**。

---

## 步骤 7｜笔记（20 分钟）

- 动态条件的写法套路（`条件, 列, 值` 三段式）
- N+1 的图示：坏写法 vs 好写法
- 一条：`like '%x%'` 为什么用不上索引

---

## 卡住了看这里

| 现象 | 原因 | 解决 |
|---|---|---|
| 加 tag 后查不到数据 | `tags` 存的是 `["Java"]` 这种 JSON，like 要匹配子串 | 用 `JVM` 而不是 `["JVM"]` 试 |
| SQL 里没有 tag 条件 | DTO 字段没加 / 请求没带上 | 看控制台 SQL，先确认参数进来了 |
| 接口报 40000 | `pageSize` 超限（> 200 或 > 20） | 改小 |

---

## 今日自测

1. 分页插件是怎么把 `limit` 加进 SQL 的？
2. 逻辑删除后，`removeById` 实际执行了什么 SQL？
3. 什么是 N+1？这个项目怎么解的？
4. 为什么 `tags` 存 JSON 字符串会让查询变难？
5. `like '%x%'` 为什么用不上索引？

---

## 明天

前端：为什么有的页面能在服务端就拿到数据，有的必须等浏览器？
