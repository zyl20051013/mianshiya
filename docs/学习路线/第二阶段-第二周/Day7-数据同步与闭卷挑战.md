# Day 7｜数据同步 + 闭卷挑战

> ⏱ 约 6 小时（周末）
> 🎯 产出：全量同步 + 增量同步 + 一次独立重写
> ✅ 验收：改数据库能同步到 ES，删了的数据搜不到

---

## 步骤 1｜先想 5 分钟

MySQL 是主库，ES 是"副本"。副本怎么跟主库保持一致？

三种思路：

1. **双写**：代码里存完 MySQL 再存 ES
2. **定时同步**：每隔一段时间扫一遍变化的数据
3. **订阅变更**：监听 binlog（Canal）、或走 MQ

本项目用 **2（定时）+ 全量兜底**。先想清楚各自的优缺点，再看代码。

---

## 步骤 2｜全量同步（40 分钟）

**要求**：`job/once/FullSyncQuestionToEs.java`

1. 实现 `CommandLineRunner`（项目启动时执行一次）
2. 查出所有题目
3. 转成 `QuestionEsDTO`
4. **每 500 条一批** `saveAll`（不要一次全塞，会 OOM / 超时）

<details>
<summary>参考答案</summary>

```java
// @Component   // 需要时再打开
@Slf4j
public class FullSyncQuestionToEs implements CommandLineRunner {

    @Resource private QuestionService questionService;
    @Resource private QuestionEsDao questionEsDao;

    @Override
    public void run(String... args) {
        List<Question> list = questionService.list();
        if (CollUtil.isEmpty(list)) return;

        List<QuestionEsDTO> dtoList = list.stream()
                .map(QuestionEsDTO::objToDto)
                .collect(Collectors.toList());

        int pageSize = 500;
        int total = dtoList.size();
        for (int i = 0; i < total; i += pageSize) {
            int end = Math.min(i + pageSize, total);
            log.info("sync {} - {}", i, end);
            questionEsDao.saveAll(dtoList.subList(i, end));
        }
    }
}
```

</details>

**执行方式**：把 `@Component` 的注释打开 → 重启 → 看日志 → **再注释回去**（否则每次启动都全量同步一次）。

**验收**：

```powershell
curl.exe "http://localhost:9200/question/_count?pretty"
```

数量应该等于 `select count(*) from question where isDelete = 0`。

> 等等，这里有个坑：`questionService.list()` 是走 MyBatis-Plus 的，会**自动过滤掉逻辑删除的数据**。这对全量同步没问题（已删的不该进 ES），但增量同步就不行了——往下看。

---

## 步骤 3｜增量同步（50 分钟）

**要求**：`job/cycle/IncSyncQuestionToEs.java`

1. `@Scheduled(fixedRate = 60 * 1000)` 每分钟跑
2. 查**近 5 分钟**内 `updateTime` 有变化的题目
3. 转 DTO，批量写入 ES

难点来了：**怎么把"已删除"的题目也查出来？**

如果只用 `questionService.list(wrapper)`，逻辑删除的数据永远查不到，ES 里那条就一直是 `isDelete=0`——**用户会搜到已经删掉的题目**。

所以要用原生 SQL 绕过逻辑删除：`mapper/QuestionMapper.java`

```java
/**
 * 查询题目列表（包括已被删除的数据）
 */
@Select("select * from question where updateTime >= #{minUpdateTime}")
List<Question> listQuestionWithDelete(Date minUpdateTime);
```

<details>
<summary>增量任务参考答案</summary>

```java
// @Component
@Slf4j
public class IncSyncQuestionToEs {

    @Resource private QuestionMapper questionMapper;
    @Resource private QuestionEsDao questionEsDao;

    @Scheduled(fixedRate = 60 * 1000)
    public void run() {
        long FIVE_MINUTES = 5 * 60 * 1000L;
        Date from = new Date(System.currentTimeMillis() - FIVE_MINUTES);
        List<Question> list = questionMapper.listQuestionWithDelete(from);
        if (CollUtil.isEmpty(list)) return;

        List<QuestionEsDTO> dtoList = list.stream()
                .map(QuestionEsDTO::objToDto)
                .collect(Collectors.toList());

        int pageSize = 500;
        for (int i = 0; i < dtoList.size(); i += pageSize) {
            int end = Math.min(i + pageSize, dtoList.size());
            questionEsDao.saveAll(dtoList.subList(i, end));
        }
    }
}
```

</details>

### 三个细节，决定你会不会踩坑

1. **为什么是"近 5 分钟"而不是"上次同步时间"**：定时任务可能延迟、可能失败，多查一点是幂等的（用 id 覆盖写），漏查就永远补不回来。
2. **`isDelete=1` 的文档会带着这个字段进 ES**，搜索时 `filter termQuery("isDelete", 0)` 就会把它过滤掉——**这就是删除的同步方式：不删文档，改标记**。
3. **用 id 作为 ES 的 `_id`**（`@Id`），所以重复同步是覆盖，天然幂等。这是同步任务可靠性的基础。

---

## 步骤 4｜验证同步（30 分钟）

1. 打开两个 job 的 `@Component`，重启
2. 在后台新建一道题目"测试同步"
3. 等 1 分钟（定时任务触发 + ES 刷新）
4. 前端搜索"测试同步" → 能搜到
5. 后台删除这道题
6. 再等 1 分钟，再搜 → **搜不到了**

第 6 步是重点：如果还能搜到，说明你的增量同步没查已删除的数据。

---

## 步骤 5｜同步方案对比（20 分钟，面试常问）

| 方案 | 优点 | 缺点 | 适用 |
|---|---|---|---|
| 双写 | 实时、简单 | 代码侵入、可能不一致、事务难保证 | 数据量小 |
| 定时同步 | 解耦、能兜底 | 有延迟（分钟级） | **本项目** |
| binlog（Canal） | 实时、无侵入、可靠 | 组件重、运维成本高 | 大型系统 |
| MQ 异步 | 解耦、可重试 | 要保证消息不丢 | 中大型 |

**一个必答的追问**：双写时先写 MySQL 还是先写 ES？

先写 MySQL（主库），失败了 ES 可以重试；反过来 ES 写成功、MySQL 失败，数据就脏了。**永远以主库为准。**

---

## 步骤 6｜闭卷挑战（90 分钟）

**规则**：

- 关掉所有项目代码（可以查 ES / Redis 官方文档）
- 从零实现"刷题打卡 + 日历"整条链路
- 时间到就停，没写完的部分标记出来

**任务清单**：

- [ ] `RedisConstant` 拼 key
- [ ] `RedissonConfig` 创建 client
- [ ] `addUserSignIn` / `getUserSignInRecord`
- [ ] 两个 Controller 接口（用户 id 从登录态取）
- [ ] 前端日历组件（天数 → 日期 → ECharts）
- [ ] 用 doc.html 和浏览器验证

**评分**：

| 完成度 | 说明 |
|---|---|
| 全部完成 | 这周真的学会了 |
| 后端全对、前端图表卡住 | 正常，ECharts 配置本来就靠查 |
| 卡在 key 设计或 offset | 回 Day 2 重学 |
| 卡在从登录态取用户 | 回第一周 Day 3 |

---

## 步骤 7｜复盘（40 分钟）

写一篇 `week2.md`，回答：

1. 这周你写了哪几个文件？每个文件一句话职责
2. BitMap 为什么省空间？ES 为什么快？
3. 你踩的 3 个坑（要写根因，不是"报错了"）
4. 如果让你设计"用户收藏题目"，你会用什么结构？（下周验证）

### 简历素材（攒着，别急着用）

- 基于 Redis BitMap 实现用户刷题打卡，单用户全年记录仅约 46 字节，相比 MySQL 行存储降低约 400 倍空间占用
- 基于 Elasticsearch + IK 分词实现题目全文检索，支持标题/内容/答案多字段匹配与标签过滤，替代低效的 `like` 模糊查询
- 设计全量 + 增量双通道数据同步，通过原生 SQL 绕过逻辑删除捕获删除事件，保证 ES 与 MySQL 最终一致

---

## 步骤 8｜下周预告

第三阶段（下），你要面对的是"量和并发"：

| 本周埋的问题 | 下周的答案 |
|---|---|
| 批量给题库加 1000 道题，一条条插太慢 | 批处理优化（10 种方案对比） |
| 数据库连接数不够用 | Druid 连接池配置 |
| 热门题库每次查库 | Caffeine 本地缓存 |
| 缓存和数据库不一致 | 缓存策略 + 过期 |
| 热点 key 打爆单机 | HotKey 热 key 探测 |

---

## 今日自测

1. 为什么增量同步要绕过逻辑删除？
2. 已删除的题目在 ES 里是怎么"消失"的？
3. 为什么用"近 5 分钟"而不是"上次同步时间"？
4. 双写为什么要先写 MySQL？
5. 定时同步延迟 1 分钟，用户能接受吗？什么业务不能接受？

---

## 本周验收

- [ ] Redis 和 ES 都能独立启动、独立验证
- [ ] 打卡接口能写、能查、能看懂 redis-cli 里的位
- [ ] 日历图能显示、能切年份
- [ ] 能写出 bool query 的 Java 代码
- [ ] 能说清全量/增量同步和删除同步
- [ ] 闭卷挑战完成度 ≥ 80%
