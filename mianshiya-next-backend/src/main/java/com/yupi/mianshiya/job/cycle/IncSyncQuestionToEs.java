package com.yupi.mianshiya.job.cycle;

import cn.hutool.core.collection.CollUtil;
import com.yupi.mianshiya.dao.QuestionEsDao;
import com.yupi.mianshiya.mapper.QuestionMapper;
import com.yupi.mianshiya.model.dto.question.QuestionEsDTO;
import com.yupi.mianshiya.model.entity.Question;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

 @Component // ⚠️ 测试成功前先注释掉，或者测试完记得注释，因为我们是手动验证
@Slf4j
public class IncSyncQuestionToEs {

    @Resource
    private QuestionMapper questionMapper;

    @Resource
    private QuestionEsDao questionEsDao;

    @Scheduled(fixedRate = 60 * 1000) // 每分钟执行一次
    public void run() {
        // 1. 计算 5 分钟前的时间
        long FIVE_MINUTES = 5 * 60 * 1000L;
        Date from = new Date(System.currentTimeMillis() - FIVE_MINUTES);

        // 2. 用原生 Mapper 查数据（包括逻辑删除的数据）
        List<Question> list = questionMapper.listQuestionWithDelete(from);
        if (CollUtil.isEmpty(list)) {
            return;
        }

        // 3. 转 DTO
        List<QuestionEsDTO> dtoList = list.stream()
                .map(QuestionEsDTO::objToDto)
                .collect(Collectors.toList());

        // 4. 分批存入 ES
        int pageSize = 500;
        for (int i = 0; i < dtoList.size(); i += pageSize) {
            int end = Math.min(i + pageSize, dtoList.size());
            log.info("增量同步进度：{} - {}", i, end);
            questionEsDao.saveAll(dtoList.subList(i, end));
        }
    }
}