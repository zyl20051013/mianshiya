# 核心业务与N+1

## 自测题

### 面试官提问 1：分页插件是怎么把 `limit` 加进 SQL 的？

a：项目里面配置了MyBatis-plus里面有的paginationInnerInterceptor

paginationInnerInterceptor分页拦截器，当我们再Server层调用this.page()，拦截器会在底层拦截我们的原始 SQL。

不仅会加LIMIT还会在查数据以前，先偷偷发一条SELECT COUNT（*）去查总的条数

offset也不需要自己计算

### 面试官提问 2：逻辑删除后，`removeById` 实际执行了什么 SQL？

a：在代码里我们用了（isDelete）逻辑删除，Mybatis-plus会在底层把DELETE语句改成UPDATE

实际执行的语句是 UPDATE question_bank SET isDelete = 1 WHERE id = ? AND isDelete =0


### 面试官提问 3：什么是 N+1 问题？这个项目怎么解的？

a：N+1问题是在查出主表列表（第一次查询）后，用for循环逐条去查关联表的数据（N次查询），导致数据库压力很大

解决方案：1.先查出题目列表（1次）

2.搜集所有的UserId用set去重

3.查找所有set里的UserID，用listByIds

4.在内存中用map传到VO中，这样无论多少数据都只需要查两次

+：如果数据过大，还可以用IN分批去查，防止IN里数据太多

### 面试官提问 4：为什么 `tags` 存 JSON 字符串会让查询变难？

a：因为MYSQL数据库不擅长存JSON数组，如果把标签存成["Jave","JVM"]的字符串，在查询的时候只能用like去模糊匹配

模糊匹配容易造成**误判**（比如查 `JVM` 可能会匹配到 `JVM_test`）。所以在代码里必须加上双引号（`LIKE '%"JVM"%'`）来精准匹配 JSON 里的元素


### 面试官提问 5：`like '%x%'` 为什么用不上索引？

因为 MySQL 的 B+ 树索引是**基于最左前缀原则**排序的。
如果是 `LIKE 'x%'`（右模糊），数据库知道开头是什么，可以顺着索引树快速定位。
如果是 `LIKE '%x%'`（左模糊），数据库不知道开头是什么字符，只能放弃索引，把整张表的数据全部捞出来一行行对比（全表扫描）。数据量一旦变大，查询就会卡死。

**💡 面试官想听的加分项**：
“如果非要用 MySQL 解决，只能建全文索引（Full-Text Index），但大多数企业面对这种全文搜索需求，都会直接上 Elasticsearch。”
