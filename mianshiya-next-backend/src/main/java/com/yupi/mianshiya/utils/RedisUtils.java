package com.yupi.mianshiya.utils;

import com.yupi.mianshiya.constant.RedisConstant;

public class RedisUtils {
    /**
     *
     * @param year 查询年份
     * @param userid 需要查询对象
     * @return 拼好的数据
     */
    public static String getUserSignInRedisKey(int year,long userid){
        return String.format("%s:%s:%s", RedisConstant.USER_SIGN_IN_REDIS_KEY_PREFIX,year,userid);
    }
}
