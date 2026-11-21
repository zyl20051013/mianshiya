package com.yupi.mianshiya;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;

import javax.annotation.Resource;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
public class RedisTest {

    @Resource
    private StringRedisTemplate stringRedisTemplate;

    /**
     * 测试 String 类型基础操作
     */
    @Test
    public void testString() {
        stringRedisTemplate.opsForValue().set("test:name", "yupi");
        System.out.println("获取到的名字: " + stringRedisTemplate.opsForValue().get("test:name"));
    }

    /**
     * 测试 BitMap 操作
     */
    @Test
    public void testBitMap() {
        String key = "test:sign:2026:1";

        // 1. 模拟签到：设置第 100 位和第 200 位为 true (1)
        stringRedisTemplate.opsForValue().setBit(key, 100, true);
        stringRedisTemplate.opsForValue().setBit(key, 200, true);

        // 2. 读取某一天是否签到
        System.out.println("第 100 天是否签到: " + stringRedisTemplate.opsForValue().getBit(key, 100));
        System.out.println("第 101 天是否签到: " + stringRedisTemplate.opsForValue().getBit(key, 101));
        System.out.println("第 200 天是否签到: " + stringRedisTemplate.opsForValue().getBit(key, 200));

        // 3. 统计总共签到了多少天 (BITCOUNT)
        Long count = stringRedisTemplate.execute(
                (RedisCallback<Long>) connection -> connection.bitCount(key.getBytes()));
        System.out.println("总共签到天数: " + count);
    }
}