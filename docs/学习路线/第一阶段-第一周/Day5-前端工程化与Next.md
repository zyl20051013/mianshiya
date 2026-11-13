# Day 5｜前端工程化：Next.js 到底在服务端做了什么

> ⏱ 约 3 小时
> 🎯 产出：`/about` 页面 + 菜单项
> ✅ 验收：菜单能点，页面能开

## 今天的边界

今天不写业务页面，只建立"前端工程"的整体认知。明天再写页面。

---

## 步骤 1｜先把目录看一遍（15 分钟）

在 `mianshiya-next-frontend` 下：

```
src/
├─ app/          # 路由：一个文件夹 = 一个 URL
├─ components/   # 可复用组件（题目卡片、列表、编辑器…）
├─ api/          # 自动生成！不要手改
├─ stores/       # Redux 全局状态
├─ access/       # 前端权限
├─ layouts/      # 布局（导航栏、页脚）
└─ libs/         # 请求封装（axios）
config/menu.tsx  # 菜单配置
```

一句话写下每个目录的职责，写不出来就翻开看。

---

## 步骤 2｜读 5 个关键文件（40 分钟）

| 文件 | 你要看出的东西 |
|---|---|
| `package.json` | next 14 / react 18 / antd 5 / @reduxjs/toolkit / @umijs/openapi |
| `next.config.mjs` | `output: "standalone"` 是部署用；`ignoreBuildErrors` 是教学项目图省事，**生产环境别学** |
| `openapi.config.ts` | 从 `localhost:8101/api/v2/api-docs` 生成 `src/api` |
| `src/libs/request.ts` | baseURL 8101、`withCredentials: true`、401 统一跳登录 |
| `src/stores/loginUser.ts` | Redux Toolkit 的 `createSlice`，只存登录用户 |

看到 `request.ts` 里 baseURL 是 `http://localhost:8101`，而生成代码里的路径是 `/api/xxx` —— 所以最终地址是 `8101/api/xxx`。这里很容易看懵，记下来。

---

## 步骤 3｜搞懂 Server / Client Component（30 分钟）

对照这三个文件：

| 文件 | 类型 | 依据 |
|---|---|---|
| `src/app/layout.tsx` | Client | 顶部 `"use client"`，用了 Redux Provider + useEffect |
| `src/app/page.tsx` | Server | `async` 函数 + `export const dynamic = 'force-dynamic'`，直接 `await` 接口 |
| `src/app/admin/bank/page.tsx` | Client | 有 `useState` / `useRef` / ProTable |

规则记牢：

- **服务端组件**：能直接查数据、能 SEO、不能 `useState` / `onClick`
- **客户端组件**：能交互，但拿不到服务端数据
- 边界由 `"use client"` 决定：一旦声明，它和它的子组件都进浏览器

为什么主页/题库页要 SSR？因为要 SEO 和首屏速度——这是这个项目区别于普通前后端分离项目的卖点。

---

## 步骤 4｜重新生成一次接口代码（20 分钟）

后端保持运行，执行：

```powershell
npm run openapi
```

然后看 `src/api` 里的文件有没有变化。

结论要记住：**后端接口一改，前端必须重新生成**，否则类型、路径全是旧的，报错还很难懂。

---

## 步骤 5｜动手：加一个"关于"页面（45 分钟）

### 5.1 新建 `src/app/about/page.tsx`

```tsx
import Title from "antd/es/typography/Title";

export default function AboutPage() {
  return (
    <div className="max-width-content">
      <Title level={3}>关于本站</Title>
      <p>这是一个用于学习的面试刷题平台。</p>
    </div>
  );
}
```

### 5.2 `config/menu.tsx` 里加一项

```tsx
{
  path: "/about",
  name: "关于",
},
```

### 5.3 验收

刷新 3000，菜单出现"关于"，点击能跳转。

### 5.4 加餐

给这一项加上 `access: ACCESS_ENUM.ADMIN`，然后换普通用户登录看它消失——体会"菜单级权限"是怎么做的。

---

## 步骤 6｜画前端分层图（20 分钟）

```
页面(page) → 组件(components) → 接口(api，生成的) → 请求(libs/request) → 后端
                    ↑
               全局状态(stores) / 权限(access) / 布局(layouts)
```

画完你就明白：为什么改接口只要重新生成，为什么页面里几乎不写 axios。

---

## 卡住了看这里

| 现象 | 原因 | 解决 |
|---|---|---|
| 菜单加了不显示 | `menu.tsx` 改了但没热更新 | 重启 `npm run dev` |
| 页面 404 | 目录名/文件名不对 | 必须是 `app/about/page.tsx` |
| `npm run openapi` 报错 | 后端没起 / 端口不对 | 先确认 `localhost:8101/api/v2/api-docs` 能打开 |
| 样式错乱 | antd 的 SSR 样式没注水 | 确认 `layout.tsx` 里有 `<AntdRegistry>` |

---

## 今日自测

1. `"use client"` 加在 `layout.tsx` 上，意味着什么？
2. SSR 时 axios 发出的请求，会带上浏览器的 cookie 吗？所以哪些页面**不能**用服务端渲染？
3. 为什么 antd 要包一层 `<AntdRegistry>`？
4. Redux 在这个项目里只存了什么？为什么不把题目列表也放进去？
5. 后端改了接口，前端要做哪两件事？

第 2 题是面试高频题，答案想清楚再往下走。

---

## 明天

管理后台：一个表格页，为什么能自动长出搜索、分页、弹窗。
