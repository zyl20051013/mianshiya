"use server";
import Title from "antd/es/typography/Title";
import { message } from "antd";
// 1. 只导入用到的接口
import { searchQuestionVoByPageUsingPost } from "@/api/questionController";
import QuestionTable from "@/components/QuestionTable";
import "./index.css";

/**
 * 题目列表页面
 */
// 2. 明确指定 searchParams 的类型
export default async function QuestionsPage({
                                              searchParams
                                            }: {
  searchParams: { q?: string }
}) {
  const searchText = searchParams?.q || "";
  let questionList = [];
  let total = 0;

  try {
    const res = await searchQuestionVoByPageUsingPost({
      searchText: searchText,
      pageSize: 12,
      sortField: "createTime",
      sortOrder: "descend",
    });
    // 3. 明确类型断言，解决 records 报错
    questionList = (res.data as any)?.records ?? [];
    total = Number((res.data as any)?.total) || 0;
  } catch (e: any) { // 4. 加上 : any
    message.error("获取题目列表失败，" + e.message);
  }

  return (
      <div id="questionsPage" className="max-width-content">
        <Title level={3}>题目大全</Title>
        <QuestionTable
            defaultQuestionList={questionList}
            defaultTotal={total}
            defaultSearchParams={{
              title: searchText,
            }}
        />
      </div>
  );
}