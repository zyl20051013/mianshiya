"use server";
import { Flex, Menu, message, Button, Space} from "antd";
import { getQuestionBankVoByIdUsingGet } from "@/api/questionBankController";
import Title from "antd/es/typography/Title";
import { getQuestionVoByIdUsingGet } from "@/api/questionController";
import Sider from "antd/es/layout/Sider";
import { Content } from "antd/es/layout/layout";
import QuestionCard from "@/components/QuestionCard";
import Link from "next/link";
import "./index.css";

/**
 * 题库题目详情页
 * @constructor
 */
export default async function BankQuestionPage({ params }) {
  const { questionBankId, questionId } = params;

  // 获取题库详情
  let bank = undefined;
  try {
    const res = await getQuestionBankVoByIdUsingGet({
      id: questionBankId,
      needQueryQuestionList: true,
      // 可以自行扩展为分页实现
      pageSize: 200,
    });
    bank = res.data;
  } catch (e) {
    message.error("获取题库列表失败，" + e.message);
  }
  // 错误处理
  if (!bank) {
    return <div>获取题库详情失败，请刷新重试</div>;
  }

  // 获取题目详情
  let question = undefined;
  try {
    const res = await getQuestionVoByIdUsingGet({
      id: questionId,
    });
    question = res.data;
  } catch (e) {
    message.error("获取题目详情失败，" + e.message);
  }
  // 错误处理
  if (!question) {
    return <div>获取题目详情失败，请刷新重试</div>;
  }

  // 题目菜单列表
  const questionMenuItemList = (bank.questionPage?.records || []).map((q) => {
    return {
      label: (
        <Link href={`/bank/${questionBankId}/question/${q.id}`}>{q.title}</Link>
      ),
      key: q.id,
    };
  });
  // 👇 核心逻辑：计算上一题和下一题
  const questionList = bank.questionPage?.records || [];
  // 找到当前题目在数组里的下标（注意转 String 匹配）
  const currentIndex = questionList.findIndex((q) => String(q.id) === String(questionId));

  // 如果 currentIndex > 0，说明有上一题；否则为 null
  const prevQuestion = currentIndex > 0 ? questionList[currentIndex - 1] : null;
  // 如果 currentIndex 不是最后一个，说明有下一题；否则为 null
  const nextQuestion = currentIndex >= 0 && currentIndex < questionList.length - 1 ? questionList[currentIndex + 1] : null;
  return (
    <div id="bankQuestionPage">
      <Flex gap={24}>
        <Sider width={240} theme="light" style={{ padding: "24px 0" }}>
          <Title level={4} style={{ padding: "0 20px" }}>
            {bank.title}
          </Title>
          <Menu items={questionMenuItemList} selectedKeys={[question.id]} />
        </Sider>
        <Content>
          {/* 原来的题目卡片 */}
          <QuestionCard question={question} />

          {/* 👇 新加的上一题/下一题区域 */}
          <Flex justify="space-between" style={{ marginTop: 24 }}>
            {/* 上一题：有则显示链接，无则置灰 */}
            {prevQuestion ? (
                <Link href={`/bank/${questionBankId}/question/${prevQuestion.id}`}>
                  <Button type="default">上一题</Button>
                </Link>
            ) : (
                <Button type="default" disabled>
                  上一题
                </Button>
            )}

            {/* 下一题：有则显示链接，无则置灰 */}
            {nextQuestion ? (
                <Link href={`/bank/${questionBankId}/question/${nextQuestion.id}`}>
                  <Button type="primary">下一题</Button>
                </Link>
            ) : (
                <Button type="primary" disabled>
                  下一题
                </Button>
            )}
          </Flex>
        </Content>
      </Flex>
    </div>
  );
}
