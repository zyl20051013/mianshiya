# 自己遇到的问题



我把你 `mianshiya-phase1` 的后端复制到工作区跑了一遍，完整栈拿到了，**问题复现了**。结论很明确：**不是签到代码的问题，是你加的那个依赖。**

---

## 根因链

```
你 pom 里加了 redisson-spring-boot-starter 3.17.7
        ↓ 它的 pom 里依赖了 spring-boot-starter-actuator
actuator 进来了，注册了 /actuator 端点
        ↓
knife4j-openapi2 用的是 springfox 2.10.5，它扫描所有请求映射时
碰到 actuator 的端点，拿到的 patterns 是 null
        ↓
NullPointerException → documentationPluginsBootstrapper 启动失败
```

**两个铁证**：

```
INFO  o.s.b.a.e.web.EndpointLinksResolver : Exposing 1 endpoint(s) beneath base path '/actuator'
```

```
Caused by: java.lang.NullPointerException
 at WebMvcPatternsRequestConditionWrapper.getPatterns(...)
 at springfox.documentation.RequestHandler.sortedPaths(...)
 at WebMvcRequestHandlerProvider.requestHandlers(...)
```

这也解释了你可能一直没想通的一点：**yml 里 `ant_path_matcher` 明明配了，为什么还报这个错？** 因为网上 90% 的答案说的是"路径匹配策略"，而你这个是**另一个原因**——actuator 和 springfox 冲突。这正是 [这个 StackOverflow 问题](https://stackoverflow.com/questions/74649600/spring-actuator-conflicting-with-springfox-documentationpluginsbootstrapper-e)描述的场景。

---

## 改法（一行）

`mianshiya-next-backend/pom.xml`，把 starter 换成普通包：

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson</artifactId>
    <version>3.21.0</version>
</dependency>
```

**我改完跑了一遍，结果**：

```
Started MainApplication in 7.153 seconds
```

> 如果哪天你确实要用 actuator，就在 starter 里排除它：
>
> ```xml
> <exclusions>
>   <exclusion>
>     <groupId>org.springframework.boot</groupId>
>     <artifactId>spring-boot-starter-actuator</artifactId>
>   </exclusion>
> </exclusions>
> ```

---

## 顺便发现的 4 个小问题


| 问题                                            | 说明                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@Qualifier("redissonClient")`                  | starter 会自己建一个`redisson` Bean，你有两个才需要限定。换回普通包后只剩一个，这个限定可以删（留着也不报错）             |
| `RedisUtils` 与 `RedisConstant` 职责重叠        | 常量在一个类、拼 key 在另一个类。课程里拼 key 的 static 方法就写在`RedisConstant` 里，二选一，别两处都放逻辑              |
| `RedisConstant` 注释乱码                        | 形如“绛惧埌鐢ㄦ埛key”，典型的“GBK 打开、UTF-8 保存”。不影响运行，但建议重打一遍，顺便看下 IDEA 右下角的 File Encoding |
| `UserController` 里 `import ...UserServiceImpl` | 没用到，删掉                                                                                                              |

---

## 你写对的地方（别改）

- `offset = date.getDayOfYear()` ✅
- `if (!bitSet.get(offset))` 保证幂等 ✅
- `asBitSet()` 拉本地再 `nextSetBit` 循环，而不是循环发请求 ✅
- userId 从登录态取，不信前端 ✅
- year 为空取当前年 ✅

签到这块逻辑是干净的，问题纯在依赖。

---

## 你现在做三步

1. 改 pom → IDEA 右上角 Maven 图标点 **Reload All Maven Projects**
2. 重启，看到 `Started MainApplication` 就对了
3. doc.html 里找 `/api/user/add/sign_in`，调完再验证：

```powershell
docker exec -it mianshiya-redis redis-cli -n 1
GETBIT user:signins:2026:309
BITCOUNT user:signins:2026:1
```

---

另外提醒一句：你现在用 Redisson 自己建客户端，所以 `MainApplication` 上那句 `exclude = {RedisAutoConfiguration.class}` **保留是对的**。等你哪天要用 `StringRedisTemplate` 才需要去掉它。

顺便说一句，我复现用的临时副本已经删了，你的工作区没被改动。
