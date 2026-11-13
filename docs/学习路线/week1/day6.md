# 基础页面与管理后台

## 自测题

### 面试官提问 1：ProTable 的 `request` 返回什么？`total` 从哪来？

a:request必须包含的三个属性变量：success（布尔值，表示是否成功），date（数组，当前页面数据），total（数字，总条数）

total是后端分页接口（listQuestionBankByPageUsingPost）返回的date.total拿到

date.total赋值必须Number()转换一下



### 面试官提问 2：`current` / `pageSize` 是谁传给 `request` 的？

a：是 **ProTable 组件内部自动传入的**。
当用户在页面底部点击“下一页”、改变“每页条数”，或者在上方输入搜索条件时，ProTable 会维护自身的内部状态，然后自动以 `params` 对象的形式（包含 `current`、`pageSize` 和搜索字段）去调用 `request` 函数。


### 面试官提问 3：为什么弹窗的 `visible` 要放在父组件？

a:React中经典的状态提升思想，打开弹窗的触发点（就是页面中的新建键）就放在父组件。父组件需要管理子组件的显示与隐藏，同时子组件提交以后也要通知父组件（onSubmit），让父组件关闭弹窗，刷新表格，如果 `visible` 放在子组件，父组件就失去了控制权


### 面试官提问 4：前端隐藏了按钮，能防住别人直接调接口吗？

a：**绝对不能。**
前端的权限控制（比如用 `hideInMenu` 隐藏菜单，或者用 `v-if` 隐藏按钮）只是**掩耳盗铃**，目的是为了提升普通用户的体验，不让他们看到没有权限的功能。
真正的安全边界**永远在后端**。黑客可以直接用 Postman 或 IDEA 的 HTTP Client 绕过前端页面，直接向你的服务器发请求。所以，后端每一个敏感接口（如删除题库、新建题目）都必须加上 `@AuthCheck` 鉴权注解，去校验当前用户的 Session 或 Token 是否有权限。


### 面试官提问 5：新增和修改为什么要用两个 DTO（AddRequest / UpdateRequest）？

a：add：不需要传主键id（后端用雪花算法生成），必填选项有很多

update：必须传主键id，且有些信息不让修改，比如创建者，创建时间等待
