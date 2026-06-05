# Frontend Template

> 仓库结构说明：当前管理端源码位于 `apps/admin-web/`，本文中的 `src/`、`public/`、`index.html` 等路径均相对于 `apps/admin-web/`。

AI App 前端脚手架模板，基于 React 18 + React Router DOM 6 + Vite 7 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui 构建。

## 技术栈

- **React 18** — UI 框架
- **React Router DOM 6** — 前端路由
- **Vite 7** — 构建工具，构建目标 ES2015
- **TypeScript 5.8** — 类型系统，bundler 模式
- **Tailwind CSS 3.4** — 原子化 CSS 框架，使用 CSS 变量主题系统
- **shadcn/ui** — 基于 Radix UI 的组件库（default 风格，CSS 变量模式）
- **ESLint 9** — 代码检查
- **PostCSS + Autoprefixer** — CSS 后处理

### 关键依赖

- **class-variance-authority** — 组件变体管理
- **clsx + tailwind-merge** — 条件样式合并（`cn()` 工具函数）
- **Radix UI** — 无障碍原语组件
- **Recharts** — 图表库
- **Embla Carousel** — 轮播组件
- **Sonner** — Toast 通知
- **Vaul** — Drawer 组件
- **cmdk** — Command Palette
- **react-day-picker + date-fns** — 日期选择
- **react-resizable-panels** — 可调整大小面板
- **react-dropzone** — 文件拖拽上传
- **input-otp** — OTP 输入
- **next-themes** — 主题切换
- **lucide-react** — 图标库
- **ai-app-client** — AI App 客户端 SDK

## 项目结构

```
src/
├── main.tsx             # 入口文件，副作用导入 `ai-app-client`（注入全局 fetch 拦截器），用 StrictMode 渲染 <App />
├── app.tsx              # 应用根组件，包含 AppProviders + BrowserRouter + Routes 路由定义；特别注意：非特殊情况 AppProviders 与 BrowserRouter 不要去掉；⚠️ 必须引入 app.css。
├── app.css              # 全局样式 & CSS 变量（light/dark 主题） 必须维护在这里，禁止额外创建其他样式文件（如 index.css）。⚠️ 如果 SPEC.md 中提供了CSS 变量值（颜色/字号/间距/圆角等），必须用 SPEC.md 给定的值替换 app.css 中 :root 和 .dark 下的默认变量（如 --primary、--background 等），不要保留默认值。
├── vite-env.d.ts        # Vite 类型声明
├── pages/
│   ├── index.tsx        # 首页示例内容（默认路由 `/`），⚠️ 必须使用真正的首页内容替换掉；
│   └── not-found.tsx    # 404 兜底页（路由 `*`），可按需保留或定制文案
├── lib/
│   ├── utils.ts         # `cn()` 样式合并工具函数
│   ├── url.ts           # **URL 工具的所有导出**：`resolveUrl(url)`（API 请求路径拼 BASE_URL）、`resolveUrl(url, true)` / `toAbsoluteUrl(url)`（图片预览拼 Origin）
│   ├── api.ts           # `apiFetch` 工具：fetch 包装器，自动注入 Authorization header。全局 fetch 拦截已由 ai-app-client 在入口处接管
│   └── auth.ts          # Token 提取工具（优先 window.__SUPABASE_ACCESS_TOKEN__，其次 Cookie access_token）
├── hooks/
│   ├── use-mobile.tsx   # 移动端检测 hook
│   └── use-dark-mode.ts # 暗黑主题 hook，封装 next-themes，提供 isDark / toggle / setTheme 等
├── types/
│   ├── contacts.ts      # 通讯录相关类型定义（Employee, SearchResult, ApiResponse）
│   └── department.ts    # 部门相关类型定义（DeptItem, GetDeptTreeResponse）
└── components/
    ├── ui/              # shadcn/ui 组件目录
    ├── providers/       # AppProviders 全局 Provider（ThemeProvider + Toaster）
    ├── upload/          # 文件上传组件（图片/附件/拖拽）
    ├── employee-selector/  # 人员选择器组件
    ├── dept-selector/      # 部门选择器组件
    ├── selector/           # 通用搜索选择器底层组件
    └── CurrentUser.tsx     # 当前登录人组件（头像 + Popover 用户信息卡片）
index.html               # HTML 入口，挂载 #root 节点，加载 /src/main.tsx；特别注意 <title> 内容需要替换为应用实际名称。⚠️ 除非用户明确要求，否则不要删除 index.html 中已有的任何内容（如 <script>、<meta>、注释等），只允许新增或修改，防止误删平台注入的关键配置。
public/app-icon.svg      # 应用图标，需要根据应用实际情况生成，注意规格尺寸要符合 favicon 标准。
supabase/tables/         # Supabase 表定义目录（默认仅占位 .gitkeep，按业务需要新增 SQL 表定义）
```

## 路径别名

使用 `@/*` 映射到 `./src/*`，在 `tsconfig.app.json` 和 `vite.config.ts` 中均已配置。

## shadcn/ui 组件列表

组件位于 `src/components/ui/`，通过 `@/components/ui/<name>` 引用。所有 shadcn/ui 组件都已内置，无需额外生成或者添加 shadcn/ui 组件。

### 表单 & 输入

| 组件 | 文件 | 描述 |
|------|------|------|
| Button | `button.tsx` | 按钮组件，支持 default / destructive / outline / secondary / ghost / link 等变体 |
| Button Group | `button-group.tsx` | 按钮组，将多个按钮组合在一起 |
| Input | `input.tsx` | 文本输入框 |
| Input Group | `input-group.tsx` | 输入框组，支持前缀和后缀附加内容 |
| Input OTP | `input-otp.tsx` | 一次性密码输入组件 |
| Textarea | `textarea.tsx` | 多行文本输入框 |
| Checkbox | `checkbox.tsx` | 复选框 |
| Radio Group | `radio-group.tsx` | 单选按钮组 |
| Select | `select.tsx` | 下拉选择（⚠️ 注意：`<SelectItem>` 的 `value` 属性禁止传空字符串 `""`，否则会抛出运行时错误。如果选项值可能为空，请使用占位符如 `"all"` 或过滤掉空值选项） |
| Switch | `switch.tsx` | 开关切换组件 |
| Slider | `slider.tsx` | 滑块输入组件 |
| Calendar | `calendar.tsx` | 日历组件，用于日期选择（底层组件，单独使用场景较少） |
| DatePicker | `date-picker.tsx` | 日期选择器（业务推荐，Popover + Calendar 封装，单日期选择，引用路径 `@/components/ui/date-picker`，导出 `DatePicker`），表单中日期字段使用此组件 |
| DateRangePicker | `date-picker.tsx` | 日期范围选择器（业务推荐，Popover + Calendar 封装，起止日期选择，引用路径 `@/components/ui/date-picker`，导出 `DateRangePicker`），表单中日期范围字段使用此组件 |
| DateTimePicker | `date-picker.tsx` | 日期时间选择器（业务推荐，Popover + Calendar + 时分秒滚动列封装，引用路径 `@/components/ui/date-picker`，导出 `DateTimePicker`），支持 `minuteStep` / `secondStep` 步长控制和 `showSeconds` 秒列开关，表单中需要同时选择日期和时间的字段使用此组件 |
| Label | `label.tsx` | 表单标签 |
| Field | `field.tsx` | 表单字段组件，包含标签和错误信息 |
| ImageUpload | `@/components/upload/image.tsx` | 图片链接/图片上传（业务组件，缩略图预览 / 头像、封面、商品图场景；详见下方「内置组件 → Upload」） |
| AttachmentUpload / DragUpload | `@/components/upload/attachment.tsx` · `drag.tsx` | 附件上传（业务组件，列表 / 拖拽两种形态，适合合同、文档、任意附件；详见下方「内置组件 → Upload」） |
| EmployeeSelector | `@/components/employee-selector/EmployeeSelector.tsx` | 人员选择（业务组件，单选 / 多选 / 只读；表单只存 `emp_id` 字符串时用 `empId` / `empIds` 入参自动回显；详见下方「内置组件 → EmployeeSelector」） |
| DeptSelector | `@/components/dept-selector/DeptSelector.tsx` | 部门选择（业务组件，单选 / 多选 / 只读；表单只存 `dept_id` 字符串时用 `deptId` / `deptIds` 入参自动回显；详见下方「内置组件 → DeptSelector」） |

### 布局 & 导航

| 组件 | 文件 | 描述 |
|------|------|------|
| Accordion | `accordion.tsx` | 可折叠手风琴组件 |
| Breadcrumb | `breadcrumb.tsx` | 面包屑导航 |
| Navigation Menu | `navigation-menu.tsx` | 无障碍导航菜单，支持下拉子菜单 |
| Sidebar | `sidebar.tsx` | 可折叠侧边栏布局组件 |
| Tabs | `tabs.tsx` | 选项卡切换组件 |
| Separator | `separator.tsx` | 内容分隔线 |
| Scroll Area | `scroll-area.tsx` | 自定义滚动区域，带有样式化滚动条 |
| Resizable | `resizable.tsx` | 可调整大小的面板布局 |

### 弹层 & 对话框

| 组件 | 文件 | 描述 |
|------|------|------|
| Dialog | `dialog.tsx` | 模态对话框 |
| Alert Dialog | `alert-dialog.tsx` | 确认提示对话框 |
| Sheet | `sheet.tsx` | 滑出面板（侧边抽屉） |
| Drawer | `drawer.tsx` | 移动端友好的抽屉组件（基于 Vaul） |
| Popover | `popover.tsx` | 浮动弹出框 |
| Tooltip | `tooltip.tsx` | 工具提示 |
| Hover Card | `hover-card.tsx` | 悬停时显示的卡片 |
| Context Menu | `context-menu.tsx` | 右键上下文菜单 |
| Dropdown Menu | `dropdown-menu.tsx` | 下拉菜单 |
| Menubar | `menubar.tsx` | 水平菜单栏 |
| Command | `command.tsx` | 命令面板（基于 cmdk） |

### 反馈 & 状态

| 组件 | 文件 | 描述 |
|------|------|------|
| Alert | `alert.tsx` | 提示/警告消息组件 |
| Sonner | `sonner.tsx` | Toast 通知组件（基于 Sonner） |
| Progress | `progress.tsx` | 进度条 |
| Spinner | `spinner.tsx` | 加载旋转指示器 |
| Skeleton | `skeleton.tsx` | 骨架屏加载占位 |
| Badge | `badge.tsx` | 徽章标签，用于标签和状态指示 |
| Empty | `empty.tsx` | 空状态组件 |

### 展示 & 媒体

| 组件 | 文件 | 描述 |
|------|------|------|
| Avatar | `avatar.tsx` | 头像组件 |
| Card | `card.tsx` | 卡片容器 |
| Table | `table.tsx` | 数据表格 |
| Chart | `chart.tsx` | 图表组件（基于 Recharts） |
| Carousel | `carousel.tsx` | 轮播组件（基于 Embla Carousel） |
| Aspect Ratio | `aspect-ratio.tsx` | 保持宽高比的容器 |
| Item | `item.tsx` | 通用列表/菜单项组件 |
| Kbd | `kbd.tsx` | 键盘快捷键展示组件 |

### 其他

| 组件 | 文件 | 描述 |
|------|------|------|
| Collapsible | `collapsible.tsx` | 可折叠容器 |
| Toggle | `toggle.tsx` | 切换按钮 |
| Toggle Group | `toggle-group.tsx` | 切换按钮组 |
| Pagination | `pagination.tsx` | 分页组件 |

## 内置组件

脚手架还内置了以下业务组件，位于 `src/components/` 下，可直接通过 `@/components/<name>` 引用，**无需额外安装或生成**。

### Upload（文件上传）

用于上传头像、图片、附件、文档等场景。统一通过 `@/components/upload` 导入，详细文档见 `src/components/upload/README.md`。

- 图片上传（`ImageUpload`）：`src/components/upload/image.tsx` —— 缩略图预览、裁剪尺寸约束，适合头像 / 商品图 / 封面图等。
- 附件上传/拖拽上传：`src/components/upload/attachment.tsx`、`src/components/upload/drag.tsx` —— 文件列表形式展示，适合合同 / 文档 / 任意类型附件。

### 图片显示规范

**不要直接把服务端返回的相对路径赋给 `src`**，必须先通过 `resolveUrl(url, true)` 拼接为带 origin 的绝对地址：

```tsx
import { resolveUrl } from "@/lib/url"

// ✅ 正确：拼接为绝对地址
<img src={resolveUrl(url, true)} alt="" />

// ✅ 等价写法（语义别名）
import { toAbsoluteUrl } from "@/lib/url"
<img src={toAbsoluteUrl(url)} alt="" />

// ❌ 错误：相对路径不能直接用于 src
<img src={url} alt="" />
```

`resolveUrl(url, true)` / `toAbsoluteUrl(url)` 的处理逻辑：
- 已是 `http(s)://` 绝对地址 → 原样返回
- 相对路径 → 拼接 `window.location.origin + BASE_URL 前缀`
- 传入 `undefined`/空字符串 → 原样返回，不报错


### EmployeeSelector（人员选择器）（可能存在，使用前需要确认）

用于选择/展示通讯录成员，支持单选/多选/受控/只读模式，自动通过 `empId`/`empIds` 回显。
- 表单输入（可编辑）：`src/components/employee-selector/EmployeeSelector.tsx`
- 纯展示（表格列 / 详情页 / 卡片）：`src/components/employee-selector/EmployeeDisplay.tsx`（同文件导出 `EmployeeDisplay` / `EmployeeListDisplay`）
- 用法示例见 `src/components/README.md`。

### DeptSelector（部门选择器）（可能存在，使用前需要确认）

用于选择/展示组织部门，支持单选/多选/受控/只读模式，内置关键字搜索与部门树浏览弹窗。
- 表单输入（可编辑）：`src/components/dept-selector/DeptSelector.tsx`
- 纯展示（表格列 / 详情页 / 卡片）：`src/components/dept-selector/DeptDisplay.tsx`（同文件导出 `DeptDisplay` / `DeptListDisplay`）
- 用法示例见 `src/components/README.md`。

### Selector（通用搜索选择器）（可能存在，使用前需要确认）

上述 EmployeeSelector / DeptSelector 共享的底层通用组件，提供防抖搜索、下拉开闭与滚动加载等能力。需要构建其它领域选择器时优先复用，避免重复实现。位于 `src/components/selector/`。

### CurrentUser（当前登录人）

当前登录用户组件，展示 28×28 圆形头像，点击弹出 Popover 显示用户信息卡片和登出按钮。
- 数据来源：`GET /api/contacts/employees/login/user`
- 使用方式：`<CurrentUser />` 或 `<CurrentUser onLogout={() => { /* 清除 token，跳转登录页等 */ }} />`
- 位于 `src/components/CurrentUser.tsx`，通过 `@/components/CurrentUser` 引用。

---

## 主题配置

主题通过 CSS 变量定义在 `src/app.css` 中，支持 light/dark 模式。颜色使用 HSL 格式，在 `tailwind.config.js` 中通过 `hsl(var(--<token>))` 引用。

核心 design tokens：`--background`、`--foreground`、`--primary`、`--secondary`、`--muted`、`--accent`、`--destructive`、`--border`、`--input`、`--ring`、`--radius`。
