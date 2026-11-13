# Day 2｜数据模型 + 一条 CRUD 的完整骨架

> ⏱ 约 3 小时
> 🎯 产出：ER 图 + 一个自己写的接口
> ✅ 验收：doc.html 调通 `/questionBank/count`

## 今天的边界

只读"题库"这一条线。题目和用户模块明天再说，别贪多。

---

## 步骤 1｜读表，画 ER 图（25 分钟）

打开 `sql/create_table.sql`，边读边回答三个问题：

- 4 张表分别存什么？
- `question_bank.userId`、`question.userId` 指向谁？
- 题目和题库是什么关系？为什么需要中间表？

画出这张图（手画就行）：

```
user 1 ──< question_bank
user 1 ──< question
question_bank >──< question   （中间表 question_bank_question）
```

**三个必须想明白的设计点**（这是今天最值钱的部分）：

1. **为什么每张表都有 `isDelete`** —— 逻辑删除：数据不真删，方便恢复、审计、防止误删。
2. **为什么 `question.tags` 存 JSON 字符串** —— 一个字段塞数组，省一张关联表；代价是不能按标签精确查询（这是第二阶段换 ES 的动机之一）。
3. **为什么 `question_bank_question` 是硬删除**（SQL 注释里写了）—— 它上面有唯一索引 `(questionBankId, questionId)`。如果改成逻辑删除，记录还在，再绑一次就撞唯一键。

第 3 点记进笔记，它同时解释了"逻辑删除不是无脑全用"。

---

## 步骤 2｜读通用返回体（20 分钟）

打开 `common/` 目录，四个文件看完：

| 文件 | 看什么 |
|---|---|
| `BaseResponse<T>` | `code` / `data` / `message` 三个字段 |
| `ErrorCode` | 0 成功、40000 参数错、40100 未登录、40101 无权限、40400 找不到、50000 系统错误 |
| `ResultUtils` | `success()` / `error()` 两个入口 |
| `PageRequest` | `current` / `pageSize` / `sortField` / `sortOrder`，默认 1 / 10 |

在笔记里用一句话回答：**如果不用统一返回体，前端要处理多少种情况？**

---

## 步骤 3｜跟一条 add 链路（35 分钟）

打开 `controller/QuestionBankController.java`，只看 `addQuestionBank` 一个方法，在代码上标出 6 步：

1. `ThrowUtils.throwIf(dto == null, PARAMS_ERROR)` —— 参数非空
2. `BeanUtils.copyProperties(dto, entity)` —— DTO 转 Entity
3. `questionBankService.validQuestionBank(entity, true)` —— 业务校验（新增校验 title 非空，`true` 表示是新增）
4. `userService.getLoginUser(request)` + `setUserId` —— 补服务端该填的字段（**不能让前端传 userId**，否则能伪造）
5. `questionBankService.save(entity)` —— 落库
6. `ResultUtils.success(id)` —— 统一返回

**注意那些 `// todo` 注释**：这是代码生成器留下的标记，意思是"这里要按你的业务改"。看代码先看 todo，就知道作者动过哪里。

---

## 步骤 4｜看查询条件怎么拼（20 分钟）

打开 `service/impl/QuestionBankServiceImpl.java` 的 `getQueryWrapper`：

- 每个 `if` 对应一个可选查询条件
- `StringUtils.isNotBlank(...)` 防止空串进 SQL
- 最后处理排序，`sortField` 走白名单校验

重点想：**为什么排序字段要白名单**？因为排序字段是直接拼进 SQL 的，不校验就能注入。

---

## 步骤 5｜动手：加一个统计接口（45 分钟）

目标：`GET /api/questionBank/count` 返回题库总数。

### 5.1 接口层 `service/QuestionBankService.java`

```java
/**
 * 统计题库数量
 */
long countQuestionBank();
```

### 5.2 实现层 `service/impl/QuestionBankServiceImpl.java`

```java
@Override
public long countQuestionBank() {
    return this.count();
}
```

### 5.3 控制层 `QuestionBankController.java`

```java
/**
 * 统计题库数量
 */
@GetMapping("/count")
public BaseResponse<Long> countQuestionBank() {
    return ResultUtils.success(questionBankService.countQuestionBank());
}
```

### 5.4 验证

devtools 会自动重启，等日志出现 `Started MainApplication`，在 doc.html 里调 `/api/questionBank/count`。

**你会看到** `"data": "1"` —— 注意是**字符串**，不是数字。

这不是 bug：`config/JsonConfig.java` 把 Long 序列化成了 String，防止前端 JS 精度丢失（超过 2^53 的 id 会失真）。记进笔记。

### 5.5 加餐（可选）

再写一个 `GET /questionBank/count/title?title=Java`，只统计标题含关键字的。提示：

```java
return this.count(new QueryWrapper<QuestionBank>().like("title", title));
```

---

## 步骤 6｜写笔记（25 分钟）

今天只落 3 条：

1. 4 张表的 ER 图 + 3 个设计点
2. 一条 add 请求的 6 个步骤（要能背出来）
3. "统一返回体 + 错误码"到底解决了什么问题

---

## 卡住了看这里

| 现象 | 原因 | 解决 |
|---|---|---|
| 新接口 404 | 路径拼错 / 类上缺 `@RestController` | 检查 `@RequestMapping("/questionBank")` + `@GetMapping("/count")` |
| 返回 code 40100 | 被权限注解拦了 | `/count` 不要加 `@AuthCheck`，它是公开接口 |
| 改了代码没生效 | devtools 没触发 | 手动重启一次 |
| doc.html 看不到新接口 | 浏览器缓存 | Ctrl + F5 强刷 |

---

## 今日自测

1. Entity / DTO / VO 各解决什么问题？能合并成一个吗？
2. `BeanUtils.copyProperties` 什么时候会"静默不拷贝"？
3. 为什么中间表用硬删除？
4. 排序字段为什么要白名单校验？
5. `long` 返回给前端为什么变成了字符串？

---

## 明天

登录态到底存在哪，以及一个注解怎么就把接口锁住了。
