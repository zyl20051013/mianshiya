package com.yupi.mianshiya.job.once;

import cn.hutool.core.collection.CollUtil;
import com.yupi.mianshiya.dao.QuestionEsDao;
import com.yupi.mianshiya.model.dto.question.QuestionEsDTO;
import com.yupi.mianshiya.model.entity.Question;
import com.yupi.mianshiya.service.QuestionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
// import org.springframework.stereotype.Component; // 先注释掉，测试完再打开

import javax.annotation.Resource;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 全量同步任务：项目启动时，将 MySQL 中的所有题目同步到 ES
 */
 @Component // ⚠️ 注意：测试成功后一定要注释掉，否则每次启动都会全量跑一遍
@Slf4j
public class FullSyncQuestionToEs implements CommandLineRunner {

    @Resource
    private QuestionService questionService;

    @Resource
    private QuestionEsDao questionEsDao;

    @Override
    public void run(String... args) throws Exception {
        // 1. 查出所有题目（MyBatis-Plus 会自动过滤掉 isDelete=1 的数据）
        List<Question> questionList = questionService.list();
        if (CollUtil.isEmpty(questionList)) {
            return;
        }

        // 2. 实体转 DTO
        List<QuestionEsDTO> questionEsDTOList = questionList.stream()
                .map(QuestionEsDTO::objToDto)
                .collect(Collectors.toList());

        // 3. 分批同步（每批 500 条），防止内存溢出
        int pageSize = 500;
        int total = questionEsDTOList.size();
        log.info("全量同步开始，总共 {} 条数据", total);

        for (int i = 0; i < total; i += pageSize) {
            int end = Math.min(i + pageSize, total);
            log.info("同步进度：{} - {}", i, end);
            questionEsDao.saveAll(questionEsDTOList.subList(i, end));
        }
        log.info("全量同步完成！");
    }
}