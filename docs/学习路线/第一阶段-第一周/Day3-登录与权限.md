# Day 3｜登录态与权限：一个注解怎么锁住接口

> ⏱ 约 3 小时
> 🎯 产出：`GET /user/get/simple` + 一张登录时序图
> ✅ 验收：普通用户调管理员接口被拒，管理员能通过

## 今天的边界

只读"用户"这条线。今天读的是 **第一阶段版本**（Session + 自定义注解），不是 master 里的 Sa-Token。

> 如果你在 master 里看到 `@SaCheckRole`，那是第八期改的。两套东西别混，混了就会觉得"怎么都对不上"。

---

## 步骤 1｜读登录的四个方法（40 分钟）

打开 `service/impl/UserServiceImpl.java`，按顺序看：


| 方法             | 看什么                                                                          |
| ---------------- | ------------------------------------------------------------------------------- |
| `userRegister`   | 校验顺序：非空 → 长度 ≥ 4 → 两次一致 → 长度 ≥ 8 → 字符集 → 账号重复      |
| `userLogin`      | 查库 → 用同样规则加密 → 比对 →`session.setAttribute(USER_LOGIN_STATE, user)` |
| `getLoginUser`   | 从 session 取，取不到抛`NOT_LOGIN_ERROR`                                        |
| `getLoginUserVO` | 脱敏：把 password 等敏感字段丢掉                                                |
| `isAdmin`        | 判断`userRole`                                                                  |

边看边回答：

- 密码为什么不能明文存？
- 为什么要加盐（`SALT`）？加了盐就安全了吗？
- 登录失败为什么提示"账号或密码错误"，而不是"账号不存在"？

---

## 步骤 2｜画登录时序图（20 分钟）

在纸上画这一条，标出"存在哪"：

```
浏览器 --POST /user/login--> Controller --> Service
                                            ├─ 查 user 表
                                            ├─ 加密比对
                                            └─ session.setAttribute(...)
浏览器 <--Set-Cookie: JSESSIONID--
浏览器 --GET /xxx (带 Cookie)--> 后端 --> getSession() --> 拿到 user
```

这张图回答了一个很多人说不清的问题：**"登录"到底登录到哪去了？**

---

## 步骤 3｜读鉴权注解（25 分钟）

打开 `aop/AuthInterceptor.java` 和 `annotation/AuthCheck.java`：

- `@Around("@annotation(authCheck)")` 的切点含义：**凡是标了 `@AuthCheck` 的方法，都进这个方法**
- `AuthCheck` 上必须有 `@Retention(RUNTIME)`，否则运行期读不到注解
- 流程：取 `mustRole` → 取当前登录用户 → 比对角色 → 不通过抛 `BusinessException(NO_AUTH_ERROR)`
- `@Aspect` / `@Component` 在 44649cb 是打开的；master 里被注释了（换成了 Sa-Token 的 `StpInterfaceImpl`）

**一个必须记住的思想**：AOP 鉴权是"横切"的——业务代码里没有一行 `if (isAdmin)`，权限被抽到切面里了。这就是你简历上可以说的"统一鉴权"。

---

## 步骤 4｜读全局异常（15 分钟）

`exception/GlobalExceptionHandler.java` + `BusinessException` + `ThrowUtils`：

- `BusinessException` 继承 `RuntimeException`（所以不用显式 throws）
- `@RestControllerAdvice` 统一捕获，转成 `BaseResponse` 返回
- 所以 Controller 里**不需要 try-catch**

再想一层：如果每个接口都 try-catch，会有什么问题？（重复代码、漏 catch、错误码不统一）

---

## 步骤 5｜动手：加一个查询用户接口（45 分钟）

目标：`GET /api/user/get/simple?id=2`，返回脱敏用户信息。

要求：

1. `@GetMapping("/get/simple")`，参数 `@RequestParam long id`
2. `id <= 0` 抛参数错误
3. 查不到抛 `NOT_FOUND_ERROR`
4. **不能直接返回 User 实体**（会把 password 带出去）

先自己写，卡住再看参考：

```java
@GetMapping("/get/simple")
public BaseResponse<UserVO> getUserSimple(@RequestParam long id) {
    ThrowUtils.throwIf(id <= 0, ErrorCode.PARAMS_ERROR);
    User user = userService.getById(id);
    ThrowUtils.throwIf(user == null, ErrorCode.NOT_FOUND_ERROR);
    UserVO userVO = new UserVO();
    BeanUtils.copyProperties(user, userVO);
    return ResultUtils.success(userVO);
}
```

写完问自己两个问题：

- 这个接口要不要登录才能调？
- 任何人都能查任意用户的信息，算不算问题？

这就是**水平越权**，面试常问。你的答案是：要么加登录校验，要么只返回公开字段，要么限制"只能查自己"。

---

## 步骤 6｜验证权限（15 分钟）

按顺序做三件事：

1. admin 登录 → 调 `/questionBank/add` → 成功
2. 注册一个普通用户 → 登录 → 调 `/questionBank/add` → 返回 `40101`
3. 把普通用户 `userRole` 改成 `'ban'` → 再调 → 依然拒绝

第 2、3 步就是 `AuthInterceptor` 里那几行 if 的效果。

---

## 步骤 7｜笔记（20 分钟）

- 登录时序图
- Session vs Token 对比表（3 行就够）
- 一句话：为什么"前端藏按钮"不叫权限控制

---

## 今日自测

1. `request.getSession()` 拿到的 session 属于谁？服务器怎么认出来的？
2. 服务器重启后登录态还在吗？部署两台服务器呢？
3. 密码加盐解决了什么？MD5 加盐今天还够用吗？
4. `@AuthCheck(mustRole = "admin")` 从注解到拦截，中间发生了什么？
5. Long 为什么序列化成 String？

第 2 题的答案会引出第二阶段（Redis Session），先记住这个疑问。

---

## 明天

题目列表一次查 10 条，为什么只查了 2 次数据库？
