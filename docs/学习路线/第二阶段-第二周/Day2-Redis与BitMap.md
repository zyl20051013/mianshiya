# Day 2｜Redis 与 BitMap：一个 bit 存一天

> ⏱ 约 4 小时
> 🎯 产出：两段能跑通的 Redis 实验代码
> ✅ 验收：能用 redis-cli 和 Java 各操作一次 BitMap

---

## 步骤 1｜先想 5 分钟（合上代码）

**需求**：100 万用户，每人每天可以签到一次，要能查出某年签到过哪些天。

如果只用 MySQL，你会怎么设计？

- 一张 `user_sign_in(userId, date)` 表，100 万用户 × 365 天 = **3.65 亿行/年**
- 每行按 50 字节算 ≈ **18 GB/年**
- 查询某人某年记录：`where userId = ? and date between ? and ?`

能实现，但存储和查询都不划算。**有没有更省的？**

---

## 步骤 2｜一个 bit 表示一天（15 分钟）

一年最多 366 天，那就用 366 个二进制位：

```
bit 索引:  1  2  3  4  5 ...  309 ... 365
          [1][0][0][1][1] ... [1] ... [0]
           ↑ 第 1 天签了       ↑ 第 309 天签了
```

- **offset** = 一年中的第几天（`LocalDate.getDayOfYear()`，1~366）
- **value** = 1 表示签到，0 表示没签

**算一笔账**：

| 方案 | 单用户一年 | 100 万用户 |
|---|---|---|
| MySQL 行记录 | ~18 KB | ~18 GB |
| BitMap | 366 bit ≈ **46 字节** | ≈ **44 MB** |

差 400 倍。这就是 BitMap 存在的意义：**用位运算换空间**。

> 顺便记住另一个用法：BitMap 还能做"统计活跃用户数"（DAU）、"布隆过滤器"（第三阶段会用到）。

---

## 步骤 3｜用 redis-cli 玩一遍（30 分钟）

```powershell
docker exec -it mianshiya-redis redis-cli
```

依次敲：

```redis
SET user:1:name "yupi"
GET user:1:name

HSET user:1 name yupi age 18
HGETALL user:1

SADD tags java redis mysql
SMEMBERS tags

ZADD rank 100 user1
ZADD rank 200 user2
ZRANGE rank 0 -1 WITHSCORES

# 重点：BitMap
SETBIT sign:2026:1 100 1
GETBIT sign:2026:1 100
GETBIT sign:2026:1 101
BITCOUNT sign:2026:1
STRLEN sign:2026:1
```

最后一条 `STRLEN` 会返回字节数——你会发现设置第 100 位后，Redis 只分配了 13 个字节（100/8 + 1）。**按需分配，非常省。**

再试试越界：

```redis
SETBIT sign:2026:1 364 1
STRLEN sign:2026:1
BITCOUNT sign:2026:1
```

---

## 步骤 4｜写第一段 Java 实验（40 分钟）

在 `src/test/java/com/yupi/mianshiya/` 下新建 `RedisTest.java`：

```java
@SpringBootTest
public class RedisTest {

    @Resource
    private StringRedisTemplate stringRedisTemplate;

    @Test
    public void testString() {
        stringRedisTemplate.opsForValue().set("test:name", "yupi");
        System.out.println(stringRedisTemplate.opsForValue().get("test:name"));
    }

    @Test
    public void testBitMap() {
        String key = "test:sign:2026:1";
        // 设置第 100 位为 1
        stringRedisTemplate.opsForValue().setBit(key, 100, true);
        // 读取
        System.out.println("100 = " + stringRedisTemplate.opsForValue().getBit(key, 100));
        System.out.println("101 = " + stringRedisTemplate.opsForValue().getBit(key, 101));
        // 统计 1 的个数
        Long count = stringRedisTemplate.execute(
                (RedisCallback<Long>) connection -> connection.bitCount(key.getBytes()));
        System.out.println("count = " + count);
    }
}
```

**验收**：两个测试都绿，控制台输出符合预期。

> `setBit` 的第三个参数是 `boolean`，不是 1/0。这是 Spring Data Redis 的封装，底层还是 `SETBIT key offset 1`。

---

## 步骤 5｜写第二段：Redisson 的 RBitSet（40 分钟）

项目里用的是 **Redisson**（不是原生 StringRedisTemplate），因为它封装了分布式场景下的常用对象。

新建 `RedissonTest.java`：

```java
@SpringBootTest
public class RedissonTest {

    @Resource
    private RedissonClient redissonClient;

    @Test
    public void testBitSet() {
        RBitSet bitSet = redissonClient.getBitSet("test:rbit:2026");
        bitSet.set(100, true);
        bitSet.set(200, true);

        System.out.println("get(100) = " + bitSet.get(100));
        System.out.println("cardinality = " + bitSet.cardinality());

        // 拉到本地，一次性遍历
        BitSet local = bitSet.asBitSet();
        int index = local.nextSetBit(0);
        while (index >= 0) {
            System.out.println("签到日 = " + index);
            index = local.nextSetBit(index + 1);
        }
    }
}
```

### RBitSet 和 BitSet 的区别（面试会问）

| | `RBitSet` | `java.util.BitSet` |
|---|---|---|
| 在哪 | Redis 服务端 | 当前 JVM 内存 |
| 操作 | 每次可能发网络请求 | 纯内存，极快 |
| 适合 | 单点读写（签到） | 批量遍历（查全年） |

所以正确用法是：**写用 RBitSet，读的时候 `asBitSet()` 拉一次，再遍历。**

如果直接循环 `bitSet.get(i)` 365 次，就是 365 次网络往返——这是新手最容易踩的性能坑。

---

## 步骤 6｜对照源码（20 分钟）

打开 `service/impl/UserServiceImpl.java` 最后两个方法（约 307~352 行）：

- `addUserSignIn`：key 怎么拼、offset 用什么、为什么要先 `get` 判断
- `getUserSignInRecord`：为什么先 `asBitSet()` 再 `nextSetBit` 循环

对照你自己的写法，只找差异：

1. key 的命名规范（`user:signins:年份:用户id`）
2. 为什么用 `if (!get(offset))` 包一层（幂等：重复打卡不报错）
3. 返回的是"第几天"的数组，不是日期字符串——为什么？（留给前端换算，后端不用关心时区）

---

## 步骤 7｜闭卷（20 分钟）

合上所有代码，在纸上（或空白文件里）写出：

1. `addUserSignIn` 的完整逻辑（5 行以内）
2. `getUserSignInRecord` 的完整逻辑（8 行以内）
3. 它们的 key 长什么样

写不出来就重来一遍。**今天的目标不是"看懂"，是"能默写"。**

---

## 卡住了看这里

| 现象 | 原因 | 解决 |
|---|---|---|
| `bitCount` 编译不过 | 用了 `RedisCallback` 但没导入 | `import org.springframework.data.redis.core.RedisCallback;` |
| `RedissonClient` 注入失败 | `RedissonConfig` 没生效 / 配置前缀不对 | 检查 `@ConfigurationProperties(prefix = "spring.redis")` |
| 连不上 Redis | 容器没起 | `docker ps` / `docker start mianshiya-redis` |
| `asBitSet()` 很慢 | 数据量太大 | 本项目一年才 46 字节，不用担心 |

---

## 今日自测

1. 为什么 offset 用"一年中的第几天"，而不是"时间戳"？
2. BitMap 一年 365 天占多少字节？100 万用户呢？
3. `RBitSet` 和 `BitSet` 该在什么时候用哪个？
4. 重复调用签到接口会发生什么？为什么这么设计？
5. 如果要求"打卡后 30 天内可撤销"，BitMap 还合适吗？（想想为什么）

---

## 明天

把今天的原理变成两个真正的接口——今天你只是"玩"，明天是"交付"。
