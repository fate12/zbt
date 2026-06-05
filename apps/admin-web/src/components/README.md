# 业务组件总览

本目录提供 4 类必须复用的业务组件，业务页面 **不要自行实现** 同类逻辑：

| 组件                                | 用途                                    | 详细文档                                     |
| ----------------------------------- | --------------------------------------- | -------------------------------------------- |
| `EmployeeSelector` / `EmployeeDisplay` | 表单选人 / 表格 & 详情人员展示          | [`employee-selector/README.md`](./employee-selector/README.md) |
| `DeptSelector` / `DeptDisplay`         | 表单选部门 / 表格 & 详情部门展示        | [`dept-selector/README.md`](./dept-selector/README.md)         |
| `CurrentUser`                          | 顶部当前登录人头像 + 登出弹层           | 见下                                         |
| `ImageUpload` / `AttachmentUpload` / `DragUpload` | 图片 / 附件 / 拖拽批量上传 | [`upload/README.md`](./upload/README.md)     |

下面只列每类组件 **最常用** 的写法，完整 Props、原子组件、Hook 请查阅各自子 README。

---

## EmployeeSelector / EmployeeDisplay

源文件：`src/components/employee-selector/EmployeeSelector.tsx`、`EmployeeDisplay.tsx`

**表单选人（受控，推荐）**

表单里始终以 `Employee` 对象作为受控值，提交时再转为 `emp_id` / `emp_ids`。

```tsx
import { EmployeeSelector } from '@/components/employee-selector';
import type { Employee } from '@/types/contacts';

// 单选（如：负责人）
const [owner, setOwner] = useState<Employee | null>(null);
<EmployeeSelector value={owner} onChange={setOwner} />

// 多选（如：参与成员）
const [members, setMembers] = useState<Employee[]>([]);
<EmployeeSelector multiple value={members} onChange={setMembers} />
```

**表格列 / 详情页展示（必用 Display，禁止直接渲染 emp_id）**

```tsx
import { EmployeeDisplay, EmployeeListDisplay } from '@/components/employee-selector';

<EmployeeDisplay empId={record.owner_emp_id} />
<EmployeeListDisplay empIds={record.member_emp_ids} />
```

---

## DeptSelector / DeptDisplay

源文件：`src/components/dept-selector/DeptSelector.tsx`、`DeptDisplay.tsx`

**表单选部门（受控，推荐）**

表单里始终以 `DeptItem` 对象作为受控值，提交时再转为 `dept_id` / `dept_ids`。组件内置关键字搜索 + 部门树浏览弹窗。

```tsx
import { DeptSelector } from '@/components/dept-selector';
import type { DeptItem } from '@/types/department';

// 单选
const [dept, setDept] = useState<DeptItem | null>(null);
<DeptSelector value={dept} onChange={setDept} />

// 多选
const [depts, setDepts] = useState<DeptItem[]>([]);
<DeptSelector multiple value={depts} onChange={setDepts} />
```

**表格列 / 详情页展示（必用 Display，禁止直接渲染 dept_id）**

```tsx
import { DeptDisplay, DeptListDisplay } from '@/components/dept-selector';

<DeptDisplay deptId={record.dept_id} />
<DeptListDisplay deptIds={record.dept_ids} />

// 可选：展示完整部门路径
<DeptDisplay deptId={record.dept_id} showFullPath />
```

---

## CurrentUser（当前登录人）

源文件：`src/components/CurrentUser.tsx`

展示当前登录人或退出登录请直接使用本组件，**不要额外编写头像 + 登出逻辑**。

- 数据来源：`GET /api/contacts/employees/login/user`
- 28×28 圆形头像，点击弹出 Popover 显示用户姓名、职位与登出按钮
- 头像缺失自动降级为姓名首字符 + 浅蓝背景圆圈
- 接口报错时点击头像会展示错误提示

```tsx
// 仅头像（无登出按钮）
<CurrentUser />

// 带登出回调
<CurrentUser onLogout={() => {
  // 清除 token、跳转登录页等
  window.location.href = '/login';
}} />

// 自定义样式
<CurrentUser onLogout={handleLogout} className="ml-auto" />
```

---

## Upload（图片 / 附件 / 拖拽）

源文件：`src/components/upload/`

> ⚠️ **直接使用本目录提供的 3 个组件，不要自行写 `<input type="file">` + `fetch('/api/storage/upload')`**。
> 自行实现会丢失：进度追踪、abort 取消、受控/非受控双模式、错误重试、toast 提示、签名鉴权 header 等内置能力。

| 组件                | 形态                | 典型场景                       |
| ------------------- | ------------------- | ------------------------------ |
| `ImageUpload`       | 单张图片预览框      | 头像、封面图（替换式，无 `maxCount`） |
| `AttachmentUpload`  | 按钮 + 文件列表     | 表单内"附件"字段               |
| `DragUpload`        | 大面积拖拽区 + 列表 | 批量导入、独立上传页           |

未传 `onUpload` 时默认走 `POST /api/storage/upload`，上传成功后通过 `file.response.url` 拿到绝对访问 URL。

```tsx
import { ImageUpload, AttachmentUpload, DragUpload } from '@/components/upload';

// 单图（封面 / 头像）
<ImageUpload
  accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
  maxSize={5 * 1024 * 1024}
  onChange={(files) => {
    const uploaded = files[0];
    if (uploaded?.status === 'success') {
      setCoverUrl(uploaded.response?.url as string);
    }
  }}
/>

// 表单附件
<AttachmentUpload
  triggerText="上传附件"
  hint="支持 pdf/docx/zip，单文件 ≤ 5MB，最多 5 个"
  accept={{ 'application/pdf': ['.pdf'], 'application/zip': ['.zip'] }}
  maxSize={5 * 1024 * 1024}
  maxCount={5}
/>

// 拖拽批量
<DragUpload multiple maxCount={10} accept={{ 'image/*': [] }} />
```

需求超出三件套默认行为时（自定义后端、特殊布局），优先使用 `useUpload` Hook + `FileList` / `FileItem` 自由组合，详见 [`upload/README.md`](./upload/README.md)。
