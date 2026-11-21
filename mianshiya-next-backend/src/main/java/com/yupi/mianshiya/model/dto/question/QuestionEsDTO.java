package com.yupi.mianshiya.model.dto.question;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import com.yupi.mianshiya.model.entity.Question;
import lombok.Data;
import org.springframework.beans.BeanUtils;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

/**
 * 题目 ES 文档
 */
// 1. 👇 绑定 ES 的 question 索引
@Document(indexName = "question")
@Data
public class QuestionEsDTO implements Serializable {

    private static final long serialVersionUID = 1L;
    private static final String DATE_TIME_PATTERN = "yyyy-MM-dd HH:mm:ss";

    // 2. 👇 主键
    @Id
    private Long id;

    private String title;
    private String content;
    private String answer;
    private List<String> tags; // 注意这里是 List
    private Long userId;

    // 3. 👇 指定日期格式
    @Field(type = FieldType.Date, format = {}, pattern = DATE_TIME_PATTERN)
    private Date createTime;

    @Field(type = FieldType.Date, format = {}, pattern = DATE_TIME_PATTERN)
    private Date updateTime;

    private Integer isDelete;

    /**
     * 实体类转 ES 对象（字符串转数组）
     */
    public static QuestionEsDTO objToDto(Question question) {
        QuestionEsDTO dto = new QuestionEsDTO();
        // 拷贝同名属性
        BeanUtils.copyProperties(question, dto);
        // 手动转换 tags（因为 BeanUtils 遇到类型不同会静默跳过）
        if (StrUtil.isNotBlank(question.getTags())) {
            dto.setTags(JSONUtil.toList(question.getTags(), String.class));
        }
        return dto;
    }

    /**
     * ES 对象转实体类（数组转字符串）
     */
    public static Question dtoToObj(QuestionEsDTO dto) {
        Question question = new Question();
        BeanUtils.copyProperties(dto, question);
        // 手动转换 tags
        if (CollUtil.isNotEmpty(dto.getTags())) {
            question.setTags(JSONUtil.toJsonStr(dto.getTags()));
        }
        return question;
    }
}