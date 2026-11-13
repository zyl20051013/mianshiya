# 配置环境和跑通项目

## 自己研究遇到的问题

### 1、重新下载mysql

q:删除data文件以后，server.ism找不到ini配置文件，不能重新配置服务器密码

a：主要是不应该用server.ism文件重新配置应该用mysql-install重新下载，不过需要把之前的东西删干净

q：不是所有的地方都能调用mysql指令

a：电脑配置环境中path增加mysql/bin文件路径

### 2、下载前端配置文件

q：npm install 过程中一开始用的较低版本无法下载

a：在后面添加--legacy-peer-deps --registry=https://registry.npmmirror.com，这个也无需梯子

### 3、后端启动配置

s：jdk版本该项目是老项目用的1.8

## 自测题

### 1、为什么接口地址都要带 /api？（步骤 4）

a：用来区分前后端访问地址，方便nginx代理，更好的后端拦截

+：这个可以写在配置文件application.yml中的server.servlet.context-path:/path,所有的 controller都会加/api

e.g:

@PostMapping("/user/login")
public ...

结果是/api/user/login

### 2、前端 3000 调后端 8101，浏览器为什么不拦？

a：后端代码config文件夹中corsconfig.java允许了前端3000端口调用后端8101端口

q：为啥会拦截不同端口调用

a：浏览器中有**同源政策**，3000 和 8101 端口不同，属于跨域，浏览器默认会拦截。但是，项目里写了一个 config/CorsConfig.java 文件，里面配置了 CORS（跨域资源共享）

+：开发中config文件一般决定这些代码**在什么环境下、以什么规则去运行**。

e.g:

后端

1. **`CorsConfig.java`（跨域配置）**：就是你之前自测题里见过的，告诉浏览器允许 3000 端口来找 8101 端口拿数据。
2. **`MybatisPlusConfig.java`（数据库插件配置）**：比如配置“分页插件”（让数据库查询支持第 1 页、第 2 页），或者配置“防全表更新删除插件”（防止手滑把整个表的数据删了）。
3. **`SwaggerConfig.java` / `Knife4jConfig.java`（接口文档配置）**：你之前访问的 `doc.html` 接口文档页面，就是靠这个配置类生成的。里面会写“文档标题是什么”、“作者是谁”、“哪些接口不需要显示”。
4. **`WebMvcConfig.java`（Web 拦截器配置）**：用来配置拦截器。比如“所有带 `/api/admin` 的请求，都必须先验证用户是不是管理员”。
5. **`RedisConfig.java` / `EsConfig.java`**：你项目后面几天会用到。用来配置 Redis 缓存怎么序列化、Elasticsearch 的连接客户端怎么建。

前端

1. **`next.config.js`（框架全局配置）**：放在项目根目录。比如配置“允许加载哪些外部域名的图片”、配置前端请求后端时的代理转发规则。
2. **`.env.local`（环境变量配置）**：用来存不同环境的变量。比如本地开发时，后端的地址是 `http://localhost:8101`；上线后，地址是 `https://api.mianshiya.com`。代码里写死是不行的，全从 `.env` 里读。
3. **`config` 文件夹（业务常量配置）**：

   **路由菜单配置**：比如左侧导航栏有哪些菜单、图标是什么。

   **全局常量**：比如“每页默认显示 10 条数据”、“用户角色的枚举值”。

   **主题配置**：比如主题色是蓝色还是黑色。

### 3、注册出来的用户为什么建不了题库？（步骤 6.2）

a：注册接口在写库的时候会把userRole默认为user，但是新建题库接口加了比如 `@AuthCheck(mustRole = "admin")`这样的权限校验

### 4、登录之后，后端凭什么知道“你是谁”？（步骤 6.3）

a：牵扯cookie和session技术，当核对完信息后，浏览器会给你发一个令牌让你可以后续用令牌访问，不用泄露自己的账号密码

实现过程ai：

### 💻 代码层面到底是怎么实现的？（Spring Boot 篇）

在你的 `mianshiya-next` 项目里，其实**你并没有手写太多关于 Cookie 和 Session 的代码**，因为 Spring Boot 内置的 Tomcat 服务器帮你“全自动”处理了。

具体分为三个步骤：

#### 第一步：登录成功，创建 Session

在 `UserServiceImpl` 的 `userLogin` 方法里，当你输入的密码和数据库里的加密密码比对成功后，代码里通常会有一句类似这样的代码：

**java**

```
// 获取当前请求的 Session（如果没有，Tomcat 会自动创建一个新的）
HttpSession session = request.getSession(); 

// 把当前登录的用户信息（脱敏后的）存进去
session.setAttribute("user_login_state", user);
```

👉 **就在这一瞬间，服务器（Tomcat）的内存里开辟了一块空间，存下了你的信息，并生成了一个随机且唯一的字符串（比如 `A1B2C3D4E5`），这就是 Session ID。**

#### 第二步：服务器自动发“手牌”（Cookie）

紧接着，Tomcat 发现服务器创建了 Session，它会**自动**在 HTTP 响应的 Header 里加上一行：

**http**

```
Set-Cookie: JSESSIONID=A1B2C3D4E5; Path=/api
```

浏览器收到这个响应，就会乖乖地把 `JSESSIONID=A1B2C3D4E5` 存到当前域名（localhost）的 Cookie 文件里。

> 🎯 **这就解释了你之前用 IDEA 的 HTTP Client 或者浏览器调试时，为什么不用自己写 Cookie。因为它们内部都装了“浏览器内核”，会自动保存并带上这个手牌。**

#### 第三步：后续请求自动带上“手牌”

你接着发起“新建题库”的请求时，浏览器（或接口调试工具）会检查当前域名的 Cookie，发现里面有 `JSESSIONID`，就会**自动**在请求头里带上：

**http**

```
Cookie: JSESSIONID=A1B2C3D4E5
```

#### 第四步：后端拦截器验证“手牌”

后端收到请求后，Spring 框架会去读这个 Cookie。后端代码里有一个叫 **拦截器（Interceptor）** 或者 **AOP 切面** 的东西，它会这样写：

**java**

```
// 1. 从请求里拿到手牌（Session）
HttpSession session = request.getSession(false); // false 表示如果没有就别新建了

// 2. 看看小本本上有没有你的记录
Object userObj = session.getAttribute("user_login_state");

if (userObj == null) {
    throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录"); // 返回 40100 报错
}

// 3. 有记录，强转成 User 对象，继续往下走
User loginUser = (User) userObj;
// 把这个 loginUser 放到 ThreadLocal 里，方便后面的代码直接拿去用
```

你看，这样后端是不是就凭这个 `JSESSIONID`，查到了自己内存里的对应信息，从而知道“你是谁”了？

### **这个问题很深，可以多扩展**

### 5、首页的数据是浏览器去请求的，还是服务器去请求的？（步骤 8）

a：服务器去请求，原因是我们现在用的是next.js,ssr（**服务器渲染**）可以不用等待js下载完成才去请求数据，对SEO（搜索引擎优化）更友好

+：ssr优势

1. **对 SEO（搜索引擎优化）绝对友好**：
   搜索引擎的爬虫（如百度蜘蛛、谷歌机器人）大多是不执行 JavaScript 的。如果是传统的 React 写的页面，爬虫抓到的是一堆 `<div></div>` 空壳；而 SSR 返回的是填充好数据的 HTML 文本，爬虫一抓一个准，你的网站在百度的排名就会靠前。
2. **首屏加载速度极快（用户体验好）**：
   传统的 CSR 要先下载个几兆的 JS 文件，再发请求要数据，再渲染。在网络差的时候，用户要盯着白屏看半天。SSR 直接把渲染好的结果扔给用户，真正做到“秒开”。
3. **减少客户端压力**：
   如果是复杂的页面渲染，把计算放在服务器（性能强劲）上，比放在用户可能低端的手机浏览器上要快得多。

当然也不是完全不用csr（**客户端渲染**）模式，在个人用户这样的页面还是csr模式，可以减少服务器压力


内心os：完成今天就不记录其他的了

--2026/11/7
