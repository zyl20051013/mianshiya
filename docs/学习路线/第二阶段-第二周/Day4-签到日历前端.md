npm install echarts echarts-for-react --legacy-peer-deps --registry=https://registry.npmmirror.com# Day 4｜签到日历前端：把 [309] 变成一张绿色的图

> ⏱ 约 4 小时
> 🎯 产出：个人中心页 + 日历图 + 年份切换
> ✅ 验收：打开一道题目自动打卡，日历上今天变绿

---

## 步骤 1｜先想 5 分钟

后端只返回了 `[1, 100, 309]`（一年中的第几天）。前端要把它画成日历，需要什么？

1. 把"第 309 天"换算成 `2026-11-05` 这样的日期字符串
2. 告诉 ECharts：哪些日期有值
3. 日期范围（哪一年）

**换算公式**：`当年 1 月 1 日 + (dayOfYear - 1) 天`

为什么是 `-1`？因为 `dayOfYear` 从 1 开始（1 月 1 日 = 1），而 `add(0, "day")` 才是 1 月 1 日。

---

## 步骤 2｜先接通"打卡"（30 分钟）

打开 `src/hooks/useAddUserSignInRecord.ts`：

```ts
const useAddUserSignInRecord = () => {
  const [loading, setLoading] = useState(true);
  const doFetch = async () => {
    setLoading(true);
    try {
      await addUserSignInUsingPost({});
    } catch (e) {
      message.error("获取刷题签到记录失败，" + e.message);
    }
    setLoading(false);
  };
  useEffect(() => { doFetch(); }, []);   // 空依赖 = 只跑一次
  return { loading };
};
```

三个要理解的点：

1. **空依赖数组**：组件挂载时执行一次，不会重复请求
2. **它是 hook，不是页面**：可以被任何组件复用
3. **失败也不阻断**：打卡失败只提示，不影响用户看题

那么这个 hook 挂在哪？打开 `src/components/QuestionCard/index.tsx`：

```tsx
useAddUserSignInRecord();
```

**业务含义：打开题目卡片 = 今天刷过题 = 打卡。**

> 这就是"埋点位置"的设计：放在"用户真正产生价值行为"的组件里，而不是首页。想想如果放首页会怎样？——用户只是打开网站就被算作刷题，数据就失真了。

---

## 步骤 3｜写日历组件（60 分钟，今天的主菜）

**要求**：新建 `src/app/user/center/components/CalendarChart/index.tsx`，实现：

1. 组件挂载时请求 `getUserSignInRecordUsingGet({ year })`
2. 把返回的天数数组转成 ECharts 需要的 `[[日期字符串, 1], ...]`
3. 用 `calendar` + `heatmap` 画出来

先自己写，卡住看参考：

<details>
<summary>参考答案（先自己写 20 分钟）</summary>

```tsx
"use client";
import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { message } from "antd";
import { getUserSignInRecordUsingGet } from "@/api/userController";

const CalendarChart = () => {
  const [dataList, setDataList] = useState<number[]>([]);
  const year = new Date().getFullYear();

  const fetchDataList = async () => {
    try {
      const res = await getUserSignInRecordUsingGet({ year });
      setDataList(res.data);
    } catch (e) {
      message.error("获取刷题签到记录失败，" + e.message);
    }
  };

  useEffect(() => {
    fetchDataList();
  }, []);

  // 核心：第几天 → 日期字符串
  const optionsData = dataList.map((dayOfYear) => {
    const dateStr = dayjs(`${year}-01-01`)
      .add(dayOfYear - 1, "day")
      .format("YYYY-MM-DD");
    return [dateStr, 1];
  });

  const options = {
    visualMap: {
      show: false,
      min: 0,
      max: 1,
      inRange: { color: ["#efefef", "lightgreen"] },
    },
    calendar: {
      range: year,
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

  return <ReactECharts className="calendar-chart" option={options} />;
};

export default CalendarChart;
```

</details>

### 这三个配置块在说什么


| 配置                                              | 作用                             |
| ------------------------------------------------- | -------------------------------- |
| `visualMap`                                       | 值到颜色的映射，0 = 灰，1 = 浅绿 |
| `calendar`                                        | 画哪一年的日历、格子多大         |
| `series.heatmap` + `coordinateSystem: "calendar"` | 用热力图的方式往日历格子里填色   |

ECharts 的日历图本质是"热力图 + 日历坐标系"，理解了这句就不用背配置。

---

## 步骤 4｜接进个人中心页（30 分钟）

打开 `src/app/user/center/page.tsx`，看它怎么用 `Tabs` 组织内容，把 `CalendarChart` 放进"刷题日历"那个 tab。

同时确认入口能进去：`BasicLayout` 的头像下拉里有"个人中心"，跳到 `/user/center`。

**验收**：登录 → 点头像 → 个人中心 → 刷题日历，能看到今年所有打卡日。

---

## 步骤 5｜加年份切换（30 分钟）

现在的年份写死了。改成可切换：

```tsx
const [year, setYear] = useState(new Date().getFullYear());

useEffect(() => {
  fetchDataList();
}, [year]);   // year 变了就重新请求
```

配一个 `Select`，选项从 2024 到今年。

**这里有个坑**：`fetchDataList` 里用到了 `year`，如果不用 `useCallback` 会触发 ESLint 的 exhaustive-deps 警告。简单做法是把 `year` 作为参数传进去：

```tsx
const fetchDataList = async (y: number) => { ... };
useEffect(() => { fetchDataList(year); }, [year]);
```

---

## 步骤 6｜对照源码（15 分钟）

打开官方 `CalendarChart/index.tsx`，只看差异：

- 它用了 `"use client"` 吗？（`useState`/`useEffect` 必须 client 组件）
- 它有没有留 `console.log`？（有，说明作者也调试过——**生产代码要删**）
- 它 import 了 `dayjs`，但 `package.json` 里没有 `dayjs`！

最后一条是重点：`dayjs` 是 antd 的**传递依赖**，被 npm 提升到了 `node_modules` 根目录，所以能 import 成功。

正式项目应该显式声明依赖，否则哪天 antd 换掉 dayjs，你的代码就崩了。这就是"隐式依赖"的坑。

---

## 步骤 7｜闭卷（20 分钟）

关掉所有文件，写出：

1. `dayOfYear → 日期字符串` 那一行（含 `-1` 的原因）
2. ECharts 的三个配置块（凭记忆写结构即可）
3. `useEffect` 依赖 `year` 的写法

---

## 卡住了看这里


| 现象               | 原因                   | 解决                                     |
| ------------------ | ---------------------- | ---------------------------------------- |
| 图表不显示         | 没加`"use client"`     | 有 hooks 必须是客户端组件                |
| 日期全错一天       | 忘了`-1`               | `add(dayOfYear - 1, "day")`              |
| 打卡后日历没变     | 只请求了一次           | 手动刷新页面，或让`year` 变化触发重取    |
| 打开页面就跳登录   | 未登录时调打卡接口 401 | 这是预期行为；也可在 hook 里先判断登录态 |
| `dayjs` 找不到类型 | 未显式安装             | `npm i dayjs`（推荐补上）                |

---

## 今日自测

1. 为什么打卡 hook 挂在 `QuestionCard` 而不是首页？
2. `useEffect(() => {}, [])` 和 `useEffect(() => {}, [year])` 的区别？
3. 为什么 `dayOfYear` 要减 1？
4. 日历图是怎么用"热力图 + 日历坐标系"实现的？
5. 隐式依赖（dayjs）有什么风险？

---

## 明天

换一个战场：数据量一大、还要分词搜索，MySQL 顶不住了，怎么办？
