# PROJECT_SPEC.md
此文件由 AI 在首次生成时自动创建，记录系统功能、数据模型和接口协议。
面向对象：用户（确认需求）+ AI（执行时的业务约束）
注意：技术栈选型、代码规范、框架约束等内容由 system prompt 负责，不在此文件中描述。
生成时间: 2026-05-28 17:57

## 1. 项目基本信息

| 字段 | 值 |
|---|---|
| 项目名称 | 主播管理后台 |
| 需求摘要 | 主播信息、活动排期、数据统计、腾讯文档同步、系统设置的综合管理后台 |
| 开发模式 | 全栈应用（前端 + 后端服务 + 数据库） |
| 创建时间 | 2026-05-28 |
| 最后更新 | 2026-05-28 |

---

## 2. 产品及视觉设计

### 1.1 项目概述

「主播管理后台」产品一句话定位
面向直播运营团队的主播与活动管理中枢，覆盖主播档案、活动排期、数据看板与文档同步。

**整体调性**

- 配色：Teal (#0d9488) + Stone 暖灰 — 沉稳专业中带温度，适合运营团队日常高频使用
- 字体：Noto Sans SC / Inter — 中文优先，数字 tabular-nums
- 氛围：轻盈精致、信息密度均衡、操作反馈明确
- 节奏/密度：卡片 padding 20px / 表格行高 48px / 模块间距 24px

**设计宪法**

_默认原则（所有项目必须遵守）：_

1. 精致感 — 视觉呈现必须达到专业产品级标准，禁止粗糙拼凑
2. 像素对齐 — 所有元素必须严格对齐到网格系统
3. 系统化圆角 — 同层级元素使用统一的圆角规格
4. 留白有节奏 — 相邻模块间距遵循 8/16/24/32/48 递进关系

_项目特定原则：_

5. 数据可读性 — 数字字段必须使用 tabular-nums，KPI 数字加粗放大
   违反迹象：数据表格中数字宽度不一致导致列不对齐
6. 状态可见性 — 主播状态、活动状态必须用 Tag 颜色区分，一目了然
   违反迹象：状态用纯文本无视觉区分
7. 操作安全性 — 删除、批量操作必须有确认弹窗
   违反迹象：直接执行无二次确认

### 1.2 模块结构与页面路由

### 仪表盘 `/`

- **页面类型**：Dashboard
- **核心功能**：KPI 概览（主播总数/活跃主播/今日活动/本周直播时长）、近期活动列表、主播表现排行、数据趋势图
- **数据维度**：统计指标、活动时间线、主播排名
- **主要交互**：KPI 卡片点击跳转对应列表；趋势图支持时间范围切换

### 主播管理 `/anchors`

- **页面类型**：列表页 + 新建/编辑表单弹窗
- **核心功能**：主播列表展示、多条件筛选（状态/部门/等级）、快捷新建、编辑、查看详情、状态切换
- **数据维度**：主播昵称、头像、联系方式、状态、等级、部门、简介、粉丝数
- **主要交互**：点击行打开详情抽屉；顶部筛选栏；浮动新建按钮；状态 Tag 点击切换
- **状态定义**：待审核/已签约/直播中/已解约/已暂停，用 Tag 颜色区分

### 活动管理 `/activities`

- **页面类型**：列表页 + 新建/编辑表单弹窗
- **核心功能**：活动列表、按日期/状态筛选、关联主播选择、活动状态管理、排期展示
- **数据维度**：活动名称、关联主播、开始时间、结束时间、状态、类型、备注
- **主要交互**：点击行查看详情；日历视图切换；新建活动自动关联主播
- **状态定义**：待开始/进行中/已结束/已取消，用 Tag 颜色区分

### 数据统计 `/stats`

- **页面类型**：Dashboard / 数据报表
- **核心功能**：直播数据趋势图、主播表现对比、活动效果分析、数据导出
- **数据维度**：观看人数、直播时长、互动数、转化率、收入
- **主要交互**：时间范围选择器；图表类型切换；数据下钻

### 腾讯文档同步 `/sync`

- **页面类型**：配置页 + 同步记录列表
- **核心功能**：腾讯文档链接配置、手动触发同步、同步日志查看、自动同步开关
- **数据维度**：文档链接、同步时间、同步状态、同步结果、错误信息
- **主要交互**：配置表单；一键同步按钮；同步记录表格

### 系统设置 `/settings`

- **页面类型**：表单页
- **核心功能**：系统参数配置、通知设置、数据备份设置
- **数据维度**：配置项名称、配置值、配置类型、描述
- **主要交互**：分组表单；保存按钮；重置按钮

### 1.3 信息架构与导航体系

### 整体布局

- **导航模式**：L2 Inset（内嵌侧边栏）— 侧边栏+内容区内嵌在 root 背景中，四周露出根背景
- **侧边栏内容**：header 区域（应用 logo + 应用名称）、导航菜单、footer 区域（用户头像 + 名称）
- **顶部栏内容**：侧边栏展开收起 / 面包屑 / 页面标题
- **内容区**：最大宽度自适应 / 内边距 24px

### 主导航结构

| 导航项 | 图标 | 路由 | 可见条件 |
|---|---|---|---|
| 仪表盘 | LayoutDashboard | / | 全部 |
| 主播管理 | Users | /anchors | 全部 |
| 活动管理 | CalendarDays | /activities | 全部 |
| 数据统计 | BarChart3 | /stats | 全部 |
| 文档同步 | FileSync | /sync | 全部 |
| 系统设置 | Settings | /settings | 全部 |

### 响应式策略

- **桌面**（≥1280）：完整侧边栏 + 双栏布局
- **平板**（768–1279）：自动收起侧边栏为图标条
- **手机**（<768）：底部 Tab / 抽屉导航

### 1.4 设计系统定义

### 【视觉系统决策】

1. 布局：L2 - Inset（内嵌侧边栏）
   - 侧边栏：M1 浅色模式，背景 #ffffff / 边框 stone-200 #e7e5e4，宽度 240px 展开 / 64px 收起
   - 顶部栏：高度 56px / 背景 #ffffff
   - 内容区：最大宽度自适应 / 内边距 24px
   - 根背景色 stone-100 #f5f5f4 / 页面背景 #ffffff / 导航背景 #ffffff / 顶部栏背景 #ffffff

2. 颜色：
   - 主题色：P10 Teal (hsl(173 80% 32%)) → `--primary`，hover / 浅底 / 边框通过 opacity 派生
   - 中性色：C5 Stone（背景 stone-50 #fafaf9 / Root stone-100 #f5f5f4 / 文字 stone-900 #1c1917 / 边框 stone-200 #e7e5e4 / 弱化 stone-500 #a8a29e）
   - 语义色：成功 hsl(142 76% 36%) / 警告 hsl(38 92% 50%) / 危险 hsl(0 84% 60%) / 信息 hsl(217 91% 60%)
   - 全部写入 CSS 变量，Tailwind 通过语义 token 引用

3. 圆角：R4 - 0.75rem（圆润）→ 卡片 12px / 按钮输入 8px / Tag 6px
   - 阴影级别：卡片 shadow-sm / 悬停 shadow-md / 弹窗 shadow-lg
   - 卡片内边距：默认 20px / 紧凑 16px

4. 字体：F8 - Noto Sans SC / Inter
   - 字号层级：标题 24px / 正文 14px / 辅助 12px / KPI 32px
   - 数字加 `tabular-nums`

5. 图标：I4 - 双色调（lucide-react）

### 【差异化说明】

打破后台管理系统泛滥组合 L1 Sidebar + C3 Zinc + P1 Blue + M2 深色 + R3 + F1 + I1：
- 布局：L2 Inset 替代 L1 Sidebar，更轻盈
- 中性色：C5 Stone 暖灰替代 C3 Zinc，更有温度
- 主题色：P10 Teal 替代 P1 Blue，更有辨识度
- 圆角：R4 0.75rem 替代 R3 0.5rem，更圆润亲和
- 字体：F8 Noto Sans SC 替代 F1 Inter，中文友好
- 图标：I4 双色调替代 I1 线性，更有品质感

### 视觉 DNA

1. **形态**：圆角卡片内嵌于暖灰背景中，形成"浮岛"视觉层次
2. **色彩**：Teal 主题色作为操作引导，Stone 暖灰作为基底，传递专业而温暖的感觉
3. **装饰**：双色调图标在导航和状态标识中统一使用，形成品牌识别

### 组件规格

- 按钮档位高度：sm 32px / default 40px / lg 48px
- 输入框统一高度：40px，聚焦 ring 为 Teal 色
- 表格行高：48px，行 hover 色 stone-50
- Tag/Badge 样式：圆角 6px，小字号
- Toast 行为：顶部居中，3秒自动消失

### 信息密度

- 判断：均衡
- 具体参数：表格行 48px、卡片 padding 20px、正文 14px

---

## 2. 前端设计

### 2.1 UI Stack & Rationale

基于 shadcn/ui + Tailwind CSS v3 + React 18 + TypeScript 5 (strict) + Vite 7 构建，这套技术栈提供成熟的组件生态、类型安全和快速构建能力，适合中大型管理后台。详见 `references/stack-setup.md`。

### 2.2 Component Plan

**shadcn/ui 组件**（18个）：
`button`, `card`, `table`, `dialog`, `form`, `input`, `select`, `badge`, `dropdown-menu`, `tabs`, `skeleton`, `toast`, `sheet`, `alert-dialog`, `separator`, `scroll-area`, `calendar`, `chart`

**内置组件复用**：
- `EmployeeSelector` — 主播关联人员选择
- `EmployeeDisplay` — 主播/运营人员展示
- `ImageUpload` — 主播头像上传
- `DatePicker` / `DateTimePicker` — 活动时间选择
- `CurrentUser` — 顶栏用户信息

详见 `references/shadcn-components.md`, `references/builtin-components.md`。

### 2.3 State Coverage

每个数据视图覆盖四种 UI 状态：
- **Loading**：表格使用 `<Skeleton>` 骨架屏，按钮用 spinner
- **Empty**：`<Empty>` 组件 + 友好文案 + 主操作按钮
- **Error**：`toast.error()` 提示 + 重试按钮
- **Success**：数据正常渲染 + 操作成功 toast 反馈

详见 `references/state-and-data.md` §5。

### 2.4 Accessibility

- WCAG AA 对比度（light/dark 双模式验证）
- 键盘可达性：Tab 顺序合理，Dialog/Sheet 支持 Esc 关闭
- focus-visible ring 使用主题色
- 语义 HTML：nav/main/section 正确使用

详见 `references/responsive-and-a11y.md` Part B, `references/design-system.md` §4。

### 2.5 Dark Mode Strategy

支持 light/dark 双模式，通过 `.dark` class 切换，状态持久化到 localStorage。FOUC 预防通过内联脚本实现。

详见 `references/dark-mode.md`。

### 2.6 Pitfalls Addressed

- Tailwind v3 语法（禁用 v4 模式）详见 `references/stack-setup.md` §5
- TypeScript strict 模式，禁用 `any`，详见 `references/state-and-data.md` §2
- API 返回统一 envelope 格式 `{ success, data }`，前端先取 `.data` 再读业务数据

---

## 3. 鉴权策略 [LOCKED]

AUTH_STRATEGY: dingtalk-platform

依赖钉钉平台访问控制，不生成登录页，不使用 supabase.auth.* 相关 API。

---

## 4. 数据模型 [LOCKED after first deploy]

### 4.1 表清单

| 表名（物理名） | 显示名 | 用途 |
|---|---|---|
| anchors | 主播信息表 | 存储主播基本信息、联系方式、状态、等级等 |
| activities | 活动管理表 | 存储直播活动、排期、关联主播等 |
| sync_logs | 同步日志表 | 记录腾讯文档同步历史、状态、结果等 |
| system_settings | 系统设置表 | 存储系统配置项 |

### 4.2 表结构详情

#### 主播信息表（anchors）

用途：存储主播基本信息、联系方式、状态、等级等，对应主播管理页面

核心字段：
- id: SERIAL PRIMARY KEY
- corp_id: VARCHAR(128) 企业ID
- emp_id: VARCHAR(128) 创建人ID
- nickname: VARCHAR(128) 主播昵称
- avatar: TEXT 头像图片URL（使用 ImageUpload 组件）
- phone: VARCHAR(32) 联系电话
- email: VARCHAR(128) 邮箱
- status: VARCHAR(32) 状态：pending/signed/live/terminated/paused
- level: VARCHAR(32) 等级：junior/mid/senior/top
- department: VARCHAR(128) 所属部门
- follower_count: INTEGER 粉丝数
- bio: TEXT 个人简介
- anchor_emp_id: TEXT 关联的员工ID（使用 EmployeeSelector 组件）
- is_deleted: CHAR(1) DEFAULT 'n'
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

关联关系：独立表，activities 表通过 anchor_id 关联

#### 活动管理表（activities）

用途：存储直播活动、排期、关联主播等，对应活动管理页面

核心字段：
- id: SERIAL PRIMARY KEY
- corp_id: VARCHAR(128) 企业ID
- emp_id: VARCHAR(128) 创建人ID
- title: VARCHAR(256) 活动名称
- anchor_id: INTEGER 关联主播ID（外键关联 anchors 表）
- start_time: TIMESTAMP 开始时间
- end_time: TIMESTAMP 结束时间
- status: VARCHAR(32) 状态：upcoming/ongoing/completed/cancelled
- activity_type: VARCHAR(64) 活动类型
- description: TEXT 活动描述/备注
- viewer_count: INTEGER 观看人数
- duration_minutes: INTEGER 直播时长（分钟）
- is_deleted: CHAR(1) DEFAULT 'n'
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

关联关系：anchor_id 关联 anchors 表

#### 同步日志表（sync_logs）

用途：记录腾讯文档同步历史、状态、结果等，对应文档同步页面

核心字段：
- id: SERIAL PRIMARY KEY
- corp_id: VARCHAR(128) 企业ID
- emp_id: VARCHAR(128) 操作人ID
- doc_url: TEXT 腾讯文档链接
- sync_type: VARCHAR(32) 同步类型：manual/auto
- status: VARCHAR(32) 同步状态：success/failed/pending
- record_count: INTEGER 同步记录数
- error_message: TEXT 错误信息
- is_deleted: CHAR(1) DEFAULT 'n'
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

关联关系：独立表

#### 系统设置表（system_settings）

用途：存储系统配置项，对应系统设置页面

核心字段：
- id: SERIAL PRIMARY KEY
- corp_id: VARCHAR(128) 企业ID
- emp_id: VARCHAR(128) 操作人ID
- setting_key: VARCHAR(128) 配置项键名
- setting_value: TEXT 配置项值
- setting_type: VARCHAR(32) 值类型：string/number/boolean/json
- description: VARCHAR(256) 配置说明
- is_deleted: CHAR(1) DEFAULT 'n'
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

关联关系：独立表

---

## 5. API 接口协议 [LOCKED]

### 5.1 统一响应包络

成功：`{ success: true, data: T }`
失败：`{ success: false, error: string }`

前端读取规范：`await res.json()` 返回的是整个 envelope。**必须先取 `.data` 字段再读业务数据**，例如 `const { data } = await res.json(); /* 然后读 data.{field} */`，禁止把 envelope 当业务对象直接用。

### 5.2 接口标注规范

@NeedLogin：需要有效的用户身份，前端必须携带 Authorization header

### 5.3 接口清单

#### 仪表盘 相关

页面路径：/

##### 获取仪表盘统计数据 [领域模型: DashboardStats] [对应功能: 仪表盘数据展示]
@NeedLogin
GET /api/dashboard/stats
Response:
  { success: true, data: {
    totalAnchors: number,
    activeAnchors: number,
    todayActivities: number,
    weekLiveHours: number,
    recentActivities: Array<{ id: number, title: string, anchorNickname: string, startTime: string, status: string }>,
    anchorRanking: Array<{ id: number, nickname: string, activityCount: number, totalViewers: number }>,
    liveTrend: Array<{ date: string, viewerCount: number, duration: number }>
  } }

#### 主播管理 相关

页面路径：/anchors

##### 获取主播列表 [领域模型: Anchor] [对应功能: 主播列表展示]
@NeedLogin
GET /api/anchors?status=&level=&keyword=&page=&pageSize=
Response:
  { success: true, data: {
    list: [{ id: number, nickname: string, avatar: string, phone: string, email: string, status: string, level: string, department: string, followerCount: number, bio: string, anchorEmpId: string, createdAt: string, updatedAt: string }],
    total: number
  } }

##### 获取主播详情 [领域模型: Anchor] [对应功能: 主播详情查看]
@NeedLogin
GET /api/anchors/:id
Response:
  { success: true, data: { id: number, nickname: string, avatar: string, phone: string, email: string, status: string, level: string, department: string, followerCount: number, bio: string, anchorEmpId: string, createdAt: string, updatedAt: string } }

##### 创建主播 [领域模型: Anchor] [对应功能: 新建主播]
@NeedLogin
POST /api/anchors
Request Body:
  { nickname: string, avatar: string, phone: string, email: string, status: string, level: string, department: string, followerCount: number, bio: string, anchorEmpId: string }
Response:
  { success: true, data: { id: number, ...Anchor fields } }

##### 更新主播 [领域模型: Anchor] [对应功能: 编辑主播]
@NeedLogin
PUT /api/anchors/:id
Request Body:
  { nickname?: string, avatar?: string, phone?: string, email?: string, status?: string, level?: string, department?: string, followerCount?: number, bio?: string, anchorEmpId?: string }
Response:
  { success: true, data: { id: number, ...Anchor fields } }

##### 删除主播 [领域模型: Anchor] [对应功能: 删除主播]
@NeedLogin
DELETE /api/anchors/:id
Response:
  { success: true, data: null }

#### 活动管理 相关

页面路径：/activities

##### 获取活动列表 [领域模型: Activity] [对应功能: 活动列表展示]
@NeedLogin
GET /api/activities?status=&anchorId=&keyword=&page=&pageSize=
Response:
  { success: true, data: {
    list: [{ id: number, title: string, anchorId: number, anchorNickname: string, startTime: string, endTime: string, status: string, activityType: string, description: string, viewerCount: number, durationMinutes: number, createdAt: string }],
    total: number
  } }

##### 获取活动详情 [领域模型: Activity] [对应功能: 活动详情查看]
@NeedLogin
GET /api/activities/:id
Response:
  { success: true, data: { id: number, title: string, anchorId: number, anchorNickname: string, startTime: string, endTime: string, status: string, activityType: string, description: string, viewerCount: number, durationMinutes: number, createdAt: string } }

##### 创建活动 [领域模型: Activity] [对应功能: 新建活动]
@NeedLogin
POST /api/activities
Request Body:
  { title: string, anchorId: number, startTime: string, endTime: string, status: string, activityType: string, description: string }
Response:
  { success: true, data: { id: number, ...Activity fields } }

##### 更新活动 [领域模型: Activity] [对应功能: 编辑活动]
@NeedLogin
PUT /api/activities/:id
Request Body:
  { title?: string, anchorId?: number, startTime?: string, endTime?: string, status?: string, activityType?: string, description?: string, viewerCount?: number, durationMinutes?: number }
Response:
  { success: true, data: { id: number, ...Activity fields } }

##### 删除活动 [领域模型: Activity] [对应功能: 删除活动]
@NeedLogin
DELETE /api/activities/:id
Response:
  { success: true, data: null }

#### 数据统计 相关

页面路径：/stats

##### 获取统计数据 [领域模型: StatsData] [对应功能: 数据报表展示]
@NeedLogin
GET /api/stats?dateRange=&anchorId=
Response:
  { success: true, data: {
    totalViewers: number,
    totalDuration: number,
    totalActivities: number,
    avgViewers: number,
    viewerTrend: Array<{ date: string, viewers: number }>,
    durationTrend: Array<{ date: string, duration: number }>,
    anchorStats: Array<{ anchorId: number, nickname: string, activityCount: number, totalViewers: number, totalDuration: number }>
  } }

#### 腾讯文档同步 相关

页面路径：/sync

##### 触发同步 [领域模型: SyncLog] [对应功能: 手动同步]
@NeedLogin
POST /api/sync/trigger
Request Body:
  { docUrl: string }
Response:
  { success: true, data: { id: number, docUrl: string, syncType: string, status: string, recordCount: number, createdAt: string } }

##### 获取同步日志 [领域模型: SyncLog] [对应功能: 同步记录查看]
@NeedLogin
GET /api/sync/logs?page=&pageSize=
Response:
  { success: true, data: {
    list: [{ id: number, docUrl: string, syncType: string, status: string, recordCount: number, errorMessage: string, createdAt: string }],
    total: number
  } }

##### 获取同步配置 [领域模型: SystemSetting] [对应功能: 同步配置读取]
@NeedLogin
GET /api/sync/config
Response:
  { success: true, data: { docUrl: string, autoSync: boolean, syncInterval: number } }

##### 更新同步配置 [领域模型: SystemSetting] [对应功能: 同步配置保存]
@NeedLogin
PUT /api/sync/config
Request Body:
  { docUrl: string, autoSync: boolean, syncInterval: number }
Response:
  { success: true, data: null }

#### 系统设置 相关

页面路径：/settings

##### 获取系统设置 [领域模型: SystemSetting] [对应功能: 设置页面数据]
@NeedLogin
GET /api/settings
Response:
  { success: true, data: [{ id: number, settingKey: string, settingValue: string, settingType: string, description: string }] }

##### 更新系统设置 [领域模型: SystemSetting] [对应功能: 保存设置]
@NeedLogin
PUT /api/settings/:id
Request Body:
  { settingValue: string }
Response:
  { success: true, data: { id: number, settingKey: string, settingValue: string, settingType: string, description: string } }

---

## 6. 业务组件清单

| 组件名 | 文件路径 | 来源 | 关联页面 | 功能说明 |
|---|---|---|---|---|
| StatusTag | src/components/anchor/status-tag.tsx | 自研 | 主播管理/活动管理 | 状态标签组件，根据状态值返回不同颜色的 Badge |
| LevelBadge | src/components/anchor/level-badge.tsx | 自研 | 主播管理 | 主播等级徽章组件 |
| AnchorForm | src/components/anchor/anchor-form.tsx | 自研 | 主播管理 | 主播新建/编辑表单 |
| ActivityForm | src/components/activity/activity-form.tsx | 自研 | 活动管理 | 活动新建/编辑表单 |
| StatsChart | src/components/stats/stats-chart.tsx | 自研 | 数据统计/仪表盘 | 可复用的统计图表组件 |
| SyncConfigForm | src/components/sync/sync-config-form.tsx | 自研 | 文档同步 | 同步配置表单 |

### AI 常见映射错误组件纠正表（内置组件，无需在上表重复列出）

| 场景 | 错误做法（禁止） | 正确组件 | 引用路径 |
|---|---|---|---|
| 日期选择（单日期） | 用 `Input type="date"` 或手输日期字符串 | `DatePicker` | `@/components/ui/date-picker.tsx` |
| 日期时间选择 | 用 `Input type="date"` 或手输日期字符串 | `DateTimePicker` | `@/components/ui/date-picker.tsx` |
| 图片/文件上传 | 用 `Input` 让用户粘贴 URL | `ImageUpload` | `@/components/upload/image.tsx` |
| 人员选择（表单） | 用 Input/Select 手输工号或姓名 | `EmployeeSelector` | `@/components/employee-selector/EmployeeSelector.tsx` |
| 人员展示（只读） | 用纯文本显示工号 | `EmployeeDisplay` | `@/components/employee-selector/EmployeeDisplay.tsx` |
| 当前登录用户信息 | 自己调接口获取用户信息 | `CurrentUser` | `@/components/CurrentUser.tsx` |

---

## 7. 迭代变更记录

| 时间 | 变更类型 | 变更内容 | 变更原因 |
|---|---|---|---|
| 2026-05-28 | 初始化 | 首次生成 | 用户需求：创建主播管理后台全栈应用 |
