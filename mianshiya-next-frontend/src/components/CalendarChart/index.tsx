"use client"; // 必须加，因为用了 hooks 和图表渲染

// 1. 导入工具和组件
import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { Select, message } from "antd"; // 把 Select 引进来了
import { getUserSignInRecordUsingGet } from "@/api/userController";

const CalendarChart = () => {
    // 2. 状态定义
    const [dataList, setDataList] = useState<number[]>([]);
    const [year, setYear] = useState(new Date().getFullYear()); // 默认当前年份

    // 3. 拉取数据的函数
    const fetchDataList = async (y: number) => {
        try {
            const res = await getUserSignInRecordUsingGet({ year: y });
            setDataList(res.data || []);
        } catch (e: any) {
            message.error("获取刷题签到记录失败，" + e.message);
        }
    };

    // 4. 监听年份变化，重新拉取数据
    useEffect(() => {
        fetchDataList(year);
    }, [year]); // 👈 关键：year 变了就重新执行

    // 5. 把后端返回的“第几天”转成 ECharts 需要的日期字符串
    const optionsData = dataList.map((dayOfYear) => {
        const dateStr = dayjs(`${year}-01-01`)
            .add(dayOfYear - 1, "day")
            .format("YYYY-MM-DD");
        return [dateStr, 1]; // [日期字符串, 打卡标记]
    });

    // 6. ECharts 的配置项
    const options = {
        visualMap: {
            show: false,
            min: 0,
            max: 1,
            inRange: { color: ["#efefef", "lightgreen"] }, // 灰到绿
        },
        calendar: {
            range: year.toString(), // 显示当前选择的年份
            left: 20,
            cellSize: ["auto", 16],
            yearLabel: {
                position: "top",
                formatter: `${year} 年刷题记录`,
            },
        },
        series: {
            type: "heatmap",
            coordinateSystem: "calendar",
            data: optionsData,
        },
    };

    // 7. 页面渲染
    return (
        <div style={{ position: "relative" }}>
            {/* 年份切换下拉框 */}
            <div style={{ marginBottom: 16 }}>
                <Select
                    value={year}
                    onChange={(val) => setYear(val)} // 选择新年份时，更新 state
                    style={{ width: 120 }}
                >
                    {/* 生成最近 3 年的选项 */}
                    {Array.from({ length: 3 }).map((_, index) => {
                        const y = new Date().getFullYear() - index;
                        return (
                            <Select.Option key={y} value={y}>
                                {y} 年
                            </Select.Option>
                        );
                    })}
                </Select>
            </div>

            {/* 图表渲染区域 */}
            <ReactECharts
                option={options}
                style={{ height: 300, width: "100%" }}
            />
        </div>
    );
};

export default CalendarChart;