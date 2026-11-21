package com.yupi.mianshiya;

import org.junit.jupiter.api.Test;
import org.redisson.api.RBitSet;
import org.redisson.api.RedissonClient;
import org.springframework.boot.test.context.SpringBootTest;

import javax.annotation.Resource;
import java.util.BitSet;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
public class RedissonTest {

    @Resource
    private RedissonClient redissonClient;

    @Test
    public void testBitSet() {
        // 1. 获取分布式 BitSet 对象
        RBitSet bitSet = redissonClient.getBitSet("test:rbit:2026");

        // 2. 模拟打卡：设置第 100 位和第 200 位为 true
        bitSet.set(100, true);
        bitSet.set(200, true);

        // 3. 读取某几天
        System.out.println("get(100) = " + bitSet.get(100));
        System.out.println("get(101) = " + bitSet.get(101));

        // 4. 统计总打卡天数
        System.out.println("cardinality = " + bitSet.cardinality());

        // 5. 拉到本地，一次性遍历（⭐ 面试核心：千万别在 for 循环里发网络请求）
        BitSet local = bitSet.asBitSet();
        int index = local.nextSetBit(0);
        while (index >= 0) {
            System.out.println("签到日 = " + index);
            index = local.nextSetBit(index + 1); // 找下一个为 1 的位
        }
    }
}