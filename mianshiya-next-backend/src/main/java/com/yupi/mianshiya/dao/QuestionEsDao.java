package com.yupi.mianshiya.dao; // 注意换成你实际的包名

import com.yupi.mianshiya.model.dto.question.QuestionEsDTO;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

/**
 * 题目 ES 数据访问层
 */
public interface QuestionEsDao extends ElasticsearchRepository<QuestionEsDTO, Long> {
}