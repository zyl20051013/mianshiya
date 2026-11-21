# Day 3｜手写签到接口：从 key 设计到 Controller

今天全程手写。每个文件我都给"要求 + 骨架"，**先自己写 15 分钟，再看参考答案**。

---

## 步骤 1｜先想 5 分钟

动手前回答三个问题，写不出来就先别写代码：

1. Redis 的 key 怎么设计？（要能定位"某个用户某一年的记录"）
2. value 是什么类型？存的是日期还是位？
3. 接口需要登录吗？用户 id 从哪来？

第 3 题是关键：**用户 id 必须从登录态取，绝不能让前端传**。否则别人能替你打卡、能查你的记录——这就是越权。

---

## 步骤 2｜写 `RedisConstant`（15 分钟）

**要求**：定义 key 前缀，提供一个拼 key 的静态方法。

路径：`constant/RedisConstant.java`

<details>
<summary>参考答案（先自己写）</summary>

```java
public interface RedisConstant {

    /**
     * 用户签到记录的 Redis key 前缀
     */
    String USER_SIGN_IN_REDIS_KEY_PREFIX = "user:signins";

    /**
     * 获取用户签到记录的 Redis Key
     */
    static String getUserSignInRedisKey(int year, long userId) {
        return String.format("%s:%s:%s", USER_SIGN_IN_REDIS_KEY_PREFIX, year, userId);
    }
}
```

</details>

为什么要用 `interface` + `static` 方法？——常量类没有实例化的必要，接口天然不能 new。

---

## 步骤 3｜写 `RedissonConfig`（20 分钟）

**要求**：从 `application.yml` 的 `spring.redis` 读配置，创建一个 `RedissonClient` Bean。

<details>
<summary>参考答案（先自己写）</summary>

```java
span
```

</details>

三个知识点：

- `@ConfigurationProperties` 把 yml 里的 `spring.redis.*` 自动映射到字段，不用 `@Value` 一个个写
- `useSingleServer()` 是单机模式，集群/哨兵是另一个方法
- 这个 Bean 是**单例**，全局共用一个连接池

---

## 步骤 4｜写 Service 接口（10 分钟）

`service/UserService.java` 里加两个方法：

```java
/**
 * 添加用户签到记录
 */
boolean addUserSignIn(long userId);

/**
 * 获取用户某个年份的签到记录
 */
List<Integer> getUserSignInRecord(long userId, Integer year);
```

注意返回值：`List<Integer>` 存的是"第几天"，不是日期。**为什么这么设计？** 因为后端只关心"哪天签了"，日期格式化是展示层的事。

---

## 步骤 5｜写实现（40 分钟，今天的主菜）

**要求**：

`addUserSignIn`：

1. 拿当前日期，拼 key
2. 拿 offset（一年中的第几天）
3. 如果这位还没置 1，就置 1
4. 返回 true（重复签到也返回 true，保证幂等）

`getUserSignInRecord`：

1. year 为空就用当前年
2. 拼 key，拿 RBitSet
3. `asBitSet()` 拉到本地
4. 从 0 开始 `nextSetBit` 循环，收集所有置 1 的下标

<details>
<summary>参考答案（先自己写 15 分钟）</summary>

```java
@Override
public boolean addUserSignIn(long userId) {
    LocalDate date = LocalDate.now();
    String key = RedisConstant.getUserSignInRedisKey(date.getYear(), userId);
    RBitSet signInBitSet = redissonClient.getBitSet(key);
    // getDayOfYear() 从 1 开始，正好当 offset
    int offset = date.getDayOfYear();
    if (!signInBitSet.get(offset)) {
        signInBitSet.set(offset, true);
    }
    return true;
}

@Override
public List<Integer> getUserSignInRecord(long userId, Integer year) {
    if (year == null) {
        year = LocalDate.now().getYear();
    }
    String key = RedisConstant.getUserSignInRedisKey(year, userId);
    RBitSet signInBitSet = redissonClient.getBitSet(key);
    // 一次性拉到本地，避免 365 次网络请求
    BitSet bitSet = signInBitSet.asBitSet();
    List<Integer> dayList = new ArrayList<>();
    int index = bitSet.nextSetBit(0);
    while (index >= 0) {
        dayList.add(index);
        index = bitSet.nextSetBit(index + 1);
    }
    return dayList;
}
```

</details>

**写完后对照三个细节**：

- `if (!get)` 的意义：不判断也能 set，但判断后可以顺便做"今天是否首次签到"的业务（比如首次签到送积分）
- `nextSetBit(0)` 从 0 开始扫，但数据从 1 开始存，所以第 0 位永远是 0，不影响结果
- 返回的 list 天然有序（位索引递增），前端可以直接用

---

## 步骤 6｜写 Controller（20 分钟）

`controller/UserController.java` 加两个接口：

```java
@PostMapping("/add/sign_in")
public BaseResponse<Boolean> addUserSignIn(HttpServletRequest request) {
    // TODO 你来写：从登录态取用户，再调 service
}

@GetMapping("/get/sign_in")
public BaseResponse<List<Integer>> getUserSignInRecord(Integer year, HttpServletRequest request) {
    // TODO 你来写：year 可选，参数校验 + 从登录态取用户
}
```

<details>
<summary>参考答案</summary>

```java
@PostMapping("/add/sign_in")
public BaseResponse<Boolean> addUserSignIn(HttpServletRequest request) {
    User loginUser = userService.getLoginUser(request);
    boolean result = userService.addUserSignIn(loginUser.getId());
    return ResultUtils.success(result);
}

@GetMapping("/get/sign_in")
public BaseResponse<List<Integer>> getUserSignInRecord(Integer year, HttpServletRequest request) {
    ThrowUtils.throwIf(year != null && year < 1000, ErrorCode.PARAMS_ERROR);
    User loginUser = userService.getLoginUser(request);
    List<Integer> list = userService.getUserSignInRecord(loginUser.getId(), year);
    return ResultUtils.success(list);
}
```

</details>

**为什么这里不写 `@AuthCheck`？**
因为 `getLoginUser` 内部就会在未登录时抛 `NOT_LOGIN_ERROR`，已经拦住了。`@AuthCheck` 是用来区分角色的（admin/user），不是用来判断"有没有登录"。

---

## 步骤 7｜验证（20 分钟）

1. doc.html 调 `/api/user/login` 登录
2. 调 `POST /api/user/add/sign_in` → 返回 `true`
3. 进 Redis 验证：

```powershell
docker exec -it mianshiya-redis redis-cli -n 1
# 注意 -n 1，因为配置里 database 是 1
GETBIT user:signins:2026:1 309
BITCOUNT user:signins:2026:1
```

> 11 月 5 日是一年第 309 天。日期不同就自己算，或者用 `BITCOUNT` 确认至少有 1 位。

4. 调 `GET /api/user/get/sign_in` → 返回 `[309]`

---

## 步骤 8｜故意写错（15 分钟）

把 offset 从 `getDayOfYear()` 改成 `getDayOfMonth()`：

```java
int offset = date.getDayOfMonth();  // 错！
```

重新打卡，再查记录——你会发现**每月 5 号的打卡互相覆盖**。

改回来。这个实验的意义：**offset 的语义一旦错了，数据是静默错乱的，不会报错。** 线上这类 bug 最难查。

---

## 步骤 9｜闭卷重写（20 分钟）

新建一个空白文件，不看任何代码，写出：

- `RedisConstant`（不用想，直接默写）
- `addUserSignIn` + `getUserSignInRecord`
- 两个 Controller 方法

**这一段必须能默写。** 默不出来说明今天白学，明天重来。

---

## 卡住了看这里


| 现象                      | 原因                          | 解决               |
| ------------------------- | ----------------------------- | ------------------ |
| 注入`RedissonClient` 失败 | Config 类没加`@Configuration` | 检查注解           |
| 调接口 40100              | 没登录                        | 先调 login         |
| `GETBIT` 返回 0           | 用了 db 0 而代码写的是 db 1   | `redis-cli -n 1`   |
| 返回的数组是空            | 打卡和查询用了不同 key        | 打印 key 对比      |
| `asBitSet()` 编译错       | 导错了 BitSet                 | `java.util.BitSet` |

---

## 今日自测

1. 为什么用户 id 不能从前端传？
2. 重复签到为什么返回 true？如果业务要求"一天只能签一次，重复报错"，怎么改？
3. 查询时为什么先 `asBitSet()`，而不是循环 `get()`？
4. 返回"第几天"而不是"日期"，好处是什么？坏处是什么？
5. 如果明年要看 2025 年的记录，代码需要改吗？

---

## 明天

后端数据有了，前端怎么把它变成一张绿色的日历图。
