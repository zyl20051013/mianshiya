# Day 1｜环境升级：Redis + Elasticsearch + IK

> ⏱ 约 4 小时
> 🎯 产出：能跑的第二阶段环境（三个中间件 + 后端 + 前端）
> ✅ 验收：ES 能分词、后端能启动、首页正常

今天不写业务代码。**中间件装不好，后面 6 天全废**，所以宁可多花时间。

---

## 步骤 1｜开新工作区（10 分钟）

```powershell
cd C:\Users\周易龙\IdeaProjects\mianshiya-next
git worktree add ..\mianshiya-phase2 1a6d6db
git worktree list
```

**验收**：出现 `mianshiya-phase2  1a6d6db [detached HEAD]`。

> 不要直接 `git checkout 1a6d6db` 到 phase1 里——你上周写的 count 接口、about 页会丢。

先看一眼这周的改动范围：

```powershell
git diff --stat 44649cb 1a6d6db -- mianshiya-next-backend/src mianshiya-next-frontend/src
```

不用细看，知道"要新增 10 多个文件"就够。

---

## 步骤 2｜启动 Redis（15 分钟）

```powershell
docker run -d --name mianshiya-redis -p 6379:6379 redis:7-alpine
docker ps
```

**验收**：

```powershell
docker exec -it mianshiya-redis redis-cli ping
# 返回 PONG
```

> 没装 Docker：Windows 上用 Memurai（免费开发版），或 WSL2 里 `apt install redis-server`。装好后 `redis-cli ping` 能返回 PONG 就行。

---

## 步骤 3｜启动 Elasticsearch 7.17（25 分钟）

```powershell
docker run -d --name mianshiya-es -p 9200:9200 -p 9300:9300 `
  -e "discovery.type=single-node" `
  -e "xpack.security.enabled=false" `
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" `
  elasticsearch:7.17.9
```

> 内存不够就把 `-Xms512m` 改成 256m。ES 启动慢，等 30 秒。

**验收**：

```powershell
curl.exe http://localhost:9200
```

看到 `"number" : "7.17.9"` 和 `"tagline" : "You Know, for Search"` 就成功了。

> ⚠️ PowerShell 里 `curl` 是 `Invoke-WebRequest` 的别名，参数完全不一样。**一定写 `curl.exe`**。

---

## 步骤 4｜装 IK 中文分词器（20 分钟）

不装 IK，中文会被拆成单个汉字，"JVM 是什么"搜不出东西。

```powershell
docker exec -it mianshiya-es bin/elasticsearch-plugin install `
  https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v7.17.9/elasticsearch-analysis-ik-7.17.9.zip
docker restart mianshiya-es
```

等 30 秒，验证分词：

```powershell
curl.exe -X POST "http://localhost:9200/_analyze" -H "Content-Type: application/json" -d "{\"analyzer\":\"ik_smart\",\"text\":\"什么是JVM\"}"
```

**验收**：返回的 `tokens` 里能看到 `什么是`、`JVM` 这样的词，而不是单个字。

**装不上怎么办**（网络问题很常见）：

1. 用浏览器手动下载 zip，`docker cp` 进容器，再 `elasticsearch-plugin install file:///path/xxx.zip`
2. 实在不行：先用 `standard` 分词把流程跑通，Day 5 再回来补 IK。**不要卡在这里超过 40 分钟。**

---

## 步骤 5｜建 question 索引（15 分钟）

先看清一件事：`sql/post_es_mapping.json` 这个文件名骗人，它里面其实是**题目**的 mapping（title/content/tags/answer）。

而且它的 `aliases` 是 `question`，所以索引名要建成 `question_v1`，通过别名 `question` 访问：

```powershell
cd ..\mianshiya-phase1\mianshiya-next-backend
curl.exe -X PUT "http://localhost:9200/question_v1" -H "Content-Type: application/json" -d "@sql/post_es_mapping.json"
```

**验收**：

```powershell
curl.exe "http://localhost:9200/_cat/aliases?v"
```

应该看到 `question  question_v1` 这一行。

> 为什么要别名？以后改 mapping 要重建索引，把别名从 v1 切到 v2 就行，代码不用改。这是 ES 的常规操作。

---

## 步骤 6｜改配置、起后端（20 分钟）

打开 `src/main/resources/application.yml`，检查三处：

```yaml
spring:
  redis:
    host: localhost
    port: 6379
    database: 1        # 别用 0，避免和别的项目串数据
  elasticsearch:
    uris: http://localhost:9200
    # username: root   # 我们关掉了 ES 安全认证，这两行注释掉
    # password: 123456
```

再确认 `MainApplication` 上的 Redis 排除注解已经被注释掉（这周开始要用 Redis）：

```java
// @SpringBootApplication(exclude = {RedisAutoConfiguration.class})
@SpringBootApplication
```

启动后端，日志出现 `Started MainApplication` 即可。

---

## 步骤 7｜起前端 + 跑通上周的作业（30 分钟）

```powershell
cd ..\mianshiya-phase2\mianshiya-next-frontend
npm install
npm run dev
```

打开 3000，首页正常显示。

然后做一件**复习**的事（不许翻上周代码）：

1. 重新加 `/questionBank/count` 接口
2. 重新加 `/about` 页面 + 菜单

> 你会发现新版 `QuestionQueryRequest` 里已经有 `tags` 字段了——上周你自己加的 `tag` 字段，这周会被官方版本替代。
> 这就是"重复造轮子"的真实体验：**动手之前先看看现有代码有没有**。

---

## 卡住了看这里


| 现象                                           | 原因                              | 解决                                            |
| ---------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `docker: command not found`                    | 没装 Docker / 没开 Docker Desktop | 装好并启动，任务栏出现小鲸鱼                    |
| ES 启动后 9200 连不上                          | 还在初始化 / 内存不足             | `docker logs mianshiya-es` 看日志，等 30 秒     |
| IK 安装 404                                    | 版本和 ES 不匹配                  | 必须 7.17.x 对 7.17.x                           |
| 后端启动报`Connection refused: 6379`           | Redis 没起                        | `docker ps` 看容器状态                          |
| 后端报`NoNodeAvailableException`               | ES 没起 / 地址不对                | `curl.exe localhost:9200` 验证                  |
| 搜索报`index_not_found`                        | 索引没建                          | 重做步骤 5，确认 alias 存在                     |
| 建索引报`alias name is the same as index name` | 索引用`question` 建的             | 删掉重建：`DELETE /question` 再建 `question_v1` |

---

## 今日自测

1. 为什么索引名叫 `question_v1`，而代码里写的是 `question`？
2. 为什么 Redis 用 `database: 1` 而不是 0？
3. `ik_max_word` 和 `ik_smart` 有什么区别？（不知道就 Day 5 回答）
4. ES 装不上 IK 时，你的降级方案是什么？
5. 上周的 `tag` 字段和官方的 `tags` 字段冲突，你会怎么处理？

---

## 明天

一个 bit 存一天，一年只要 46 字节——Redis 最省内存的数据结构。
