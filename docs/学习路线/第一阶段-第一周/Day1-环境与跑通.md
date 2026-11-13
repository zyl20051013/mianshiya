# Day 1｜把项目跑起来，画出第一张地图

> ⏱ 约 3 小时
> 🎯 产出：可运行的前后端 + 1 张架构图
> ✅ 验收：接口文档能调通、浏览器能看到首页

## 今天的边界

只做四件事：**切代码 → 装环境 → 跑起来 → 造数据**。一行业务代码都不读。

跑不起来绝不往下走：后面 6 天全部建立在"能跑"上。

---

## 步骤 1｜切出第一阶段代码（10 分钟）

在 `mianshiya-next` 目录执行：

```powershell
git worktree add ..\mianshiya-phase1 44649cb
git worktree list
```

**验收**：列表里出现 `mianshiya-phase1  44649cb [detached HEAD]`。

- `44649cb` = 第四期"前端核心页面开发"，第一阶段完结的代码。
- detached HEAD 不能提交，正好：你只在里面读和改着玩。
- master 目录别动，一周后拿它做对照。

---

## 步骤 2｜确认环境（15 分钟）

| 检查 | 命令 | 期望 |
|---|---|---|
| JDK | `java -version` | 1.8.x |
| Maven | `cd mianshiya-next-backend; .\mvnw.cmd -v` | 能打印版本 |
| MySQL | `mysql --version` | 8.x |
| Node | `node -v` | ≥ 18.17（Next 14 硬要求） |

不对怎么办：

- 多个 JDK → IDEA 里 `File > Project Structure > SDK` 选 1.8，Language level 选 8。
- 没装 MySQL → 装 8.0，字符集选 utf8mb4。
- Node 太低 → 装 20 LTS，重新开终端再 `node -v`。

> 用仓库自带的 `mvnw.cmd`，不用单独装 Maven。

---

## 步骤 3｜建库（10 分钟）

```powershell
cd ..\mianshiya-phase1\mianshiya-next-backend
mysql -u root -p --default-character-set=utf8mb4 -e "source sql/create_table.sql"
```

> ⚠️ PowerShell 不支持 `<` 重定向，别写 `mysql -u root -p < sql/create_table.sql`，会直接报语法错误。

**验收**：

```powershell
mysql -u root -p -e "use mianshiya; show tables;"
```

应该正好 4 张表：`user`、`question_bank`、`question`、`question_bank_question`。

> 只用 worktree 里这份 SQL。master 那份多了 `mock_interview` 表和 user 的 5 个扩展字段，和第一阶段实体对不上。

---

## 步骤 4｜改配置（5 分钟）

打开 `src/main/resources/application.yml`，只改 3 行：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mianshiya?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
    username: root
    password: 你的密码
```

顺便记住两个数：

- `server.port: 8101`
- `server.servlet.context-path: /api`

配置里 `spring.profiles.active: dev` 但**没有 application-dev.yml**，这是正常的，不用管。

---

## 步骤 5｜启动后端（15 分钟）

IDEA 打开 `..\mianshiya-phase1\mianshiya-next-backend`（开 backend 目录，不是仓库根目录——根目录没有 pom.xml），等 Maven 索引完成，运行 `MainApplication`。

**成功标志**（日志最后几行）：

```
Started MainApplication in x.xxx seconds
Tomcat started on port(s): 8101 (http) with context path '/api'
```

浏览器打开 <http://localhost:8101/api/doc.html>，能看到 Knife4j 接口文档。

---

## 步骤 6｜造第一份数据（40 分钟）

`44649cb` 这个版本**没有种子数据脚本**（`init_data.sql` 是第二天才补的），所以得自己造——这反而是好事，你会亲手走一遍写接口的流程。

全程在 `doc.html` 里操作，**顺序不能乱**。

### 6.1 注册管理员

`用户管理 → POST /api/user/register`，Body：

```json
{"userAccount": "admin", "userPassword": "12345678", "checkPassword": "12345678"}
```

返回 `code: 0` 即成功。校验规则：账号 ≥ 4 位、密码 ≥ 8 位、两次一致。

### 6.2 把他改成管理员

注册接口只给 `user` 角色，权限不够建题库，直接改库：

```sql
update user set userRole = 'admin' where userAccount = 'admin';
```

### 6.3 登录

`POST /api/user/login`，Body：

```json
{"userAccount": "admin", "userPassword": "12345678"}
```

浏览器会自动保存 `JSESSIONID`，后面的管理员接口就靠它。

### 6.4 建一个题库

`POST /api/questionBank/add`：

```json
{"title": "Java 基础", "description": "Java 入门必会", "picture": "https://www.mianshiya.com/logo.png"}
```

记下返回的 id（大概率是 1）。

### 6.5 建两道题目

`POST /api/question/add`，注意 `tags` 是**数组**，不是字符串：

```json
{"title": "什么是 JVM？", "content": "请简述 JVM 的作用", "tags": ["Java", "JVM"], "answer": "JVM 是 Java 虚拟机……"}
```

第二道把 title 换成"String 为什么不可变？"，tags 用 `["Java"]`。

### 6.6 把题目绑到题库

`POST /api/questionBankQuestion/add`：

```json
{"questionBankId": 1, "questionId": 1}
```

现在数据齐了：1 个管理员、1 个题库、2 道题、1 条关联。

---

## 步骤 7｜启动前端（25 分钟）

另开一个终端：

```powershell
cd ..\mianshiya-phase1\mianshiya-next-frontend
npm install
npm run dev
```

打开 <http://localhost:3000>。

**验收**：首页能看到"最新题库"和"最新题目"，点进题库能看到你刚建的内容。

npm 慢就换源：`npm install --registry=https://registry.npmmirror.com`。

---

## 步骤 8｜画图 + 写笔记（30 分钟）

**画一张图**（纸笔或 draw.io 都行），四个框加箭头：

```
浏览器(3000) → Next 服务端(Node) → Spring Boot(8101 /api) → MySQL(mianshiya)
```

在每个箭头上标清楚跑的是什么：HTTP 请求 / axios / JDBC。

**建笔记文件** `docs/01-环境与启动.md`，写清：

1. 三条启动命令（数据库、后端、前端）
2. 你踩的 3 个坑 + 怎么解决的
3. 今天没搞懂的问题（丢进 `questions.md`）

---

## 卡住了看这里

| 现象 | 最可能的原因 | 解决 |
|---|---|---|
| `Access denied for user 'root'` | 密码错 | 改 application.yml；YAML 里密码有特殊字符要加引号 |
| `Unknown database 'mianshiya'` | SQL 没执行成功 | 重跑步骤 3，确认 `show tables` 有 4 张 |
| `Port 8101 was already in use` | 上次进程没退 | `netstat -ano \| findstr 8101` 找 PID，`taskkill /PID xxx /F` |
| doc.html 404 | 少了 `/api` | 地址必须是 `localhost:8101/api/doc.html` |
| 接口返回 40100 | 没登录 / cookie 丢了 | 重新调 `/user/login`，别关浏览器 |
| 首页一直空 | 后端没起 / 跨域被拦 | F12 → Network 看请求是不是 8101、状态是不是 200 |
| 中文变问号 | 建库字符集不对 | 删库重建：`create database mianshiya default charset utf8mb4` |

---

## 今日自测（答不出就回看对应步骤）

1. 为什么接口地址都要带 `/api`？（步骤 4）
2. 前端 3000 调后端 8101，浏览器为什么不拦？（步骤 4，去看 `config/CorsConfig.java`）
3. 注册出来的用户为什么建不了题库？（步骤 6.2）
4. 登录之后，后端凭什么知道"你是谁"？（步骤 6.3）
5. 首页的数据是浏览器去请求的，还是服务器去请求的？（步骤 8——明天揭晓）

---

## 明天

你会知道：为什么每张表都要有个 `isDelete`，而中间表反而不能逻辑删除。
