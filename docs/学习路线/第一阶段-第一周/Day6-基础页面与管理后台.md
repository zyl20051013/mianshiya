# Day 6｜基础页面：登录注册 + 管理后台

> ⏱ 约 5 小时（放周末）
> 🎯 产出：后台一个小改造
> ✅ 验收：管理员能完整走通"建题库 → 建题目 → 绑定 → 前台看见"

## 今天的边界

今天开始"读页面 + 改页面"。页面代码比后端长，**只读你正在改的那个文件**，其余跳过。

---

## 步骤 1｜读登录页（25 分钟）

打开 `src/app/user/login/page.tsx`，关注这条链：

```
Form + onFinish
  → 调 loginUsingPost
  → dispatch(setLoginUser(res.data))    // 写全局状态
  → router.push(redirect ?? "/")        // 跳回来源页
```

三个问题：

- 为什么用 `router.push` 而不是 `window.location.href`？（前者不整页刷新）
- `redirect` 参数是哪来的？（`request.ts` 里 401 跳转时拼的）
- 登录失败怎么提示的？

---

## 步骤 2｜读注册页（15 分钟）

打开 `src/app/user/register/page.tsx`，重点看"两次密码是否一致"的校验。

想清楚：**前端校验只是为了体验，后端必须再校验一遍**。前端代码用户能改，接口才是边界。

---

## 步骤 3｜读题库管理页（35 分钟）

打开 `src/app/admin/bank/page.tsx`，这是全项目最典型的"后台表格页"，重点看四块：

### 3.1 ProTable 的 request 契约

```tsx
request={async (params, sort, filter) => {
  const { data, code } = await listQuestionBankByPageUsingPost({...});
  return { success: code === 0, data: data?.records || [], total: Number(data?.total) || 0 };
}}
```

- 入参：`params`（含 current/pageSize/搜索字段）、`sort`、`filter`
- 出参：必须是 `{ success, data, total }`，少一个表格就不对

### 3.2 columns 就是"表格 + 搜索 + 表单"三合一

- `valueType` 决定渲染方式（text / image / dateTime）
- `hideInSearch` 控制这一列不出现在搜索栏
- `hideInForm` 控制不出现在新建/编辑弹窗

### 3.3 actionRef 刷新

`actionRef.current?.reload()` —— 增删改之后手动刷新表格。

### 3.4 顺手找一个真实的 bug

第 132 行附近：`rowKey="key"`。

但数据里的主键叫 `id`，没有 `key` 字段。React 会警告 key 重复/缺失。

**这个小 bug 就是你的第一个改造点。**

---

## 步骤 4｜读一个弹窗组件（20 分钟）

打开 `src/app/admin/bank/components/CreateModal.tsx`：

- `visible` 由父组件传进来（受控）
- 提交成功后调 `onSubmit()`，父组件负责关窗 + 刷新

想清楚：**为什么 visible 不放子组件自己管？**（因为父组件需要"点新建按钮时打开它"）

---

## 步骤 5｜动手改（60 分钟）

按顺序做，每做完一个刷新看效果：

### A. 修 rowKey

```tsx
rowKey="id"
```

验收：控制台 key 警告消失。

### B. 操作列加"查看"

在 `columns` 的 `option` 里加一个链接，跳到前台题库详情：

```tsx
<Link href={`/bank/${record.id}`} target="_blank">查看</Link>
```

验收：点"查看"能打开 `/bank/1`。

### C. 加餐（量力而行）

给表格加一列"题目数"。

提示：`question_bank` 表里没有这个字段，需要后端在 `QuestionBankVO` 里补一个 `questionCount`，再在 `getQuestionBankVOPage` 里批量统计。**做不到就跳过**，第二阶段会专门讲批量操作。

---

## 步骤 6｜走一遍完整业务流程（40 分钟）

这是今天最重要的一步——像真实用户一样用一遍：

1. 用 admin 登录后台
2. 建一个题库"Java 并发"
3. 建 2 道题目
4. 到题目管理里，把题目绑定到题库
5. 打开前台 `/banks`，点进"Java 并发"，能看到题目
6. 点进题目详情，能看到答案

**任何一步不对，都记进 `problems.md`**——这是最好的测试用例，也是面试时"你遇到过什么困难"的素材。

---

## 步骤 7｜笔记（30 分钟）

- ProTable 的 request 契约（3 个入参、1 个返回结构）
- 受控弹窗的套路（父管 visible，子管表单）
- 一句话：为什么前端权限不算安全

---

## 今日自测

1. ProTable 的 `request` 返回什么？`total` 从哪来？
2. `current` / `pageSize` 是谁传给 `request` 的？
3. 为什么弹窗的 `visible` 要放在父组件？
4. 前端隐藏了按钮，能防住别人直接调接口吗？
5. 新增和修改为什么要用两个 DTO（AddRequest / UpdateRequest）？

---

## 明天

把一周串成一条线，然后试着讲出来。
