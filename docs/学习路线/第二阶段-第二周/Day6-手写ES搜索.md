# Day 6｜手写 ES 搜索：从 DSL 到 Java

> ⏱ 约 4 小时
> 🎯 产出：`POST /question/search/page/vo` + 搜索页打通
> ✅ 验收：搜索框输入"JVM"能命中，中文能分词

今天是把昨天手写的 DSL 翻译成代码。**先写，再对照。**

---

## 步骤 1｜先想 5 分钟

搜索接口的入参和出参是什么？

- 入参：沿用 `QuestionQueryRequest`（已经有 `searchText`、`tags`、`pageSize` 等字段）
- 返回：`Page<QuestionVO>`（和列表接口保持一致，前端不用改）

**关键问题**：ES 返回的是 `QuestionEsDTO`，前端要的是 `QuestionVO`，中间怎么转？

答案复用上周的套路：`ES 文档 → Question 实体 → 复用 getQuestionVOPage → VO`。

---

## 步骤 2｜写 ES 文档类（30 分钟）

**要求**：`model/dto/question/QuestionEsDTO.java`

1. 加 `@Document(indexName = "question")`（对应别名）
2. `id` 上加 `@Id`
3. `createTime` / `updateTime` 加 `@Field(type = Date, pattern = "yyyy-MM-dd HH:mm:ss")`
4. `tags` 用 `List<String>`，并提供两个静态转换方法：
   - `objToDto`：Entity → DTO，`tags` 从 JSON 字符串转 List
   - `dtoToObj`：DTO → Entity，`tags` 从 List 转回 JSON 字符串

<details>
<summary>关键片段（先自己写）</summary>

```java
@Document(indexName = "question")
@Data
public class QuestionEsDTO implements Serializable {

    private static final String DATE_TIME_PATTERN = "yyyy-MM-dd HH:mm:ss";

    @Id
    private Long id;
    private String title;
    private String content;
    private String answer;
    private List<String> tags;
    private Long userId;

    @Field(type = FieldType.Date, format = {}, pattern = DATE_TIME_PATTERN)
    private Date createTime;

    @Field(type = FieldType.Date, format = {}, pattern = DATE_TIME_PATTERN)
    private Date updateTime;

    private Integer isDelete;

    public static QuestionEsDTO objToDto(Question question) {
        QuestionEsDTO dto = new QuestionEsDTO();
        BeanUtils.copyProperties(question, dto);
        if (StrUtil.isNotBlank(question.getTags())) {
            dto.setTags(JSONUtil.toList(question.getTags(), String.class));
        }
        return dto;
    }

    public static Question dtoToObj(QuestionEsDTO dto) {
        Question question = new Question();
        BeanUtils.copyProperties(dto, question);
        if (CollUtil.isNotEmpty(dto.getTags())) {
            question.setTags(JSONUtil.toJsonStr(dto.getTags()));
        }
        return question;
    }
}
```

</details>

**最容易错的地方**：`BeanUtils.copyProperties` 遇到 `String tags` ↔ `List<String> tags` 类型不匹配，会**静默跳过**（不报错）。所以必须手动转，转完要测。

> 对照提醒：master 里 `@Document` 被注释了（第三阶段为了"没有 ES 也能部署"）。这周你要打开它。

---

## 步骤 3｜写 Dao（10 分钟）

```java
public interface QuestionEsDao extends ElasticsearchRepository<QuestionEsDTO, Long> {
}
```

一句话理解：`ElasticsearchRepository` 就像 MyBatis-Plus 的 `BaseMapper`，自带 `save` / `saveAll` / `findById` / `deleteById`。

---

## 步骤 4｜写 `searchFromEs`（60 分钟，今天的主菜）

**要求**：`service/impl/QuestionServiceImpl.java` 实现

```java
@Override
public Page<Question> searchFromEs(QuestionQueryRequest request) {
    // 1. 取参数
    // 2. 构造 bool query：filter 未删除、id、userId、tags；should 匹配 title/content/answer
    // 3. 排序：默认按 _score，有 sortField 就按字段
    // 4. 分页：注意 ES 从 0 开始
    // 5. 执行查询，把 hits 转回 Question，塞进 Page
}
```

<details>
<summary>参考答案（先自己写 25 分钟）</summary>

```java
@Override
public Page<Question> searchFromEs(QuestionQueryRequest request) {
    String searchText = request.getSearchText();
    List<String> tags = request.getTags();
    Long userId = request.getUserId();
    Long id = request.getId();
    Long notId = request.getNotId();
    // ES 分页从 0 开始，前端从 1 开始
    int current = request.getCurrent() - 1;
    int pageSize = request.getPageSize();

    BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
    // 过滤：不需要打分的条件都放 filter
    boolQuery.filter(QueryBuilders.termQuery("isDelete", 0));
    if (id != null) {
        boolQuery.filter(QueryBuilders.termQuery("id", id));
    }
    if (notId != null) {
        boolQuery.mustNot(QueryBuilders.termQuery("id", notId));
    }
    if (userId != null) {
        boolQuery.filter(QueryBuilders.termQuery("userId", userId));
    }
    // 标签：必须同时包含全部标签
    if (CollUtil.isNotEmpty(tags)) {
        for (String tag : tags) {
            boolQuery.filter(QueryBuilders.termQuery("tags", tag));
        }
    }
    // 关键词：三个字段任一命中即可
    if (StringUtils.isNotBlank(searchText)) {
        boolQuery.should(QueryBuilders.matchQuery("title", searchText));
        boolQuery.should(QueryBuilders.matchQuery("content", searchText));
        boolQuery.should(QueryBuilders.matchQuery("answer", searchText));
        boolQuery.minimumShouldMatch(1);
    }

    // 排序
    SortBuilder<?> sortBuilder = SortBuilders.scoreSort();
    if (StringUtils.isNotBlank(request.getSortField())) {
        sortBuilder = SortBuilders.fieldSort(request.getSortField())
                .order(CommonConstant.SORT_ORDER_ASC.equals(request.getSortOrder())
                        ? SortOrder.ASC : SortOrder.DESC);
    }

    NativeSearchQuery searchQuery = new NativeSearchQueryBuilder()
            .withQuery(boolQuery)
            .withPageable(PageRequest.of(current, pageSize))
            .withSorts(sortBuilder)
            .build();

    SearchHits<QuestionEsDTO> hits =
            elasticsearchRestTemplate.search(searchQuery, QuestionEsDTO.class);

    Page<Question> page = new Page<>();
    page.setTotal(hits.getTotalHits());
    List<Question> records = hits.getSearchHits().stream()
            .map(hit -> QuestionEsDTO.dtoToObj(hit.getContent()))
            .collect(Collectors.toList());
    page.setRecords(records);
    return page;
}
```

</details>

### 四个必须想明白的点

1. **`current - 1`**：前端分页从 1 开始，ES 从 0 开始。**忘了这一步，第一页的数据永远看不到。**
2. **`filter` vs `should`**：删除标记、id、标签这些"必须满足但不需要打分"的放 `filter`；关键词放 `should` 并 `minimumShouldMatch(1)`，等价于 SQL 里的 `or`。
3. **`Page<Question>` 复用 MyBatis-Plus 的对象**：这样上层 `getQuestionVOPage` 完全不用改，只换数据源。**这是很好的设计习惯——换实现不换契约。**
4. **`SearchHits.getTotalHits()`** 是 long，直接塞给 Page 的 `total`。

---

## 步骤 5｜写 Controller（15 分钟）

```java
@PostMapping("/search/page/vo")
public BaseResponse<Page<QuestionVO>> searchQuestionVOByPage(
        @RequestBody QuestionQueryRequest request, HttpServletRequest httpRequest) {
    long size = request.getPageSize();
    ThrowUtils.throwIf(size > 200, ErrorCode.PARAMS_ERROR);
    Page<Question> questionPage = questionService.searchFromEs(request);
    return ResultUtils.success(questionService.getQuestionVOPage(questionPage, httpRequest));
}
```

**验收**：doc.html 调接口，body 传 `{"searchText":"JVM","pageSize":5}`，能返回题目。

---

## 步骤 6｜改前端搜索页（40 分钟）

打开 `src/app/questions/page.tsx`，把 `listQuestionVoByPageUsingPost` 换成 `searchQuestionVoByPageUsingPost`，并接住 URL 参数：

```tsx
export default async function QuestionsPage({ searchParams }) {
  const { q: searchText } = searchParams;
  const res = await searchQuestionVoByPageUsingPost({
    searchText, pageSize: 12, sortField: "createTime", sortOrder: "descend",
  });
  ...
}
```

再确认顶部搜索框（`layouts/BasicLayout/components/SearchInput`）跳的是 `/questions?q=关键词`。

**验收**：顶部搜索"虚拟机"，结果页能出数据。

---

## 步骤 7｜对照源码 + 想一个问题（20 分钟）

对照官方实现，重点看两处差异：

1. 官方在 `searchFromEs` 里还支持 `questionBankId` 过滤（第六期加的），你这周不需要
2. master 里 `/search/page/vo` 有**降级方案**：ES 挂了就走数据库

第二个值得想：**为什么生产环境要有降级？**

如果 ES 挂了，搜索功能直接不可用，用户什么都搜不到。降级成 MySQL `like` 虽然慢、虽然不准，但"能用"永远比"不能用"好。

这就是"可用性"思维，第三阶段会系统讲。

---

## 步骤 8｜闭卷（25 分钟）

合上代码，写出 `searchFromEs` 的骨架（不需要写全，但必须包含）：

1. `filter` 未删除
2. 关键词三段 `should` + `minimumShouldMatch(1)`
3. `current - 1`
4. 返回 `Page<Question>`

写完和答案对一遍，缺哪块就补哪块。

---

## 卡住了看这里

| 现象 | 原因 | 解决 |
|---|---|---|
| 搜出来是空 | 索引里没数据 | 先手动灌 2 条（Day 5），或跑全量同步（Day 7） |
| 数据重复 | 分页算错，`current` 没减 1 | 检查 `current - 1` |
| `tags` 报类型转换错 | DTO 和 Entity 的 tags 类型不同 | 必须手动转 JSON |
| 搜索报 `failed to load elasticsearch nodes` | ES 没起 / uris 配错 | `curl.exe localhost:9200` |
| 中文搜不到 | 索引不是 ik mapping 建的 | 删索引重建 |

---

## 今日自测

1. 为什么 `current` 要减 1？
2. 关键词查询用 `should` 还是 `must`？为什么？
3. ES 返回的 DTO 怎么变成前端要的 VO？
4. `BeanUtils.copyProperties` 在 tags 上会发生什么？
5. 为什么生产环境要给搜索加数据库降级？

---

## 明天

数据在 MySQL 里改了，ES 怎么知道？——同步，这是 ES 项目里最容易出事的地方。
