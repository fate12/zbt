# DeptSelector 部门选择组件

部门选择器，支持单选/多选、受控/非受控、只读模式，内置关键字搜索和部门树浏览弹窗。

搜索/下拉交互已统一到 [`@/components/selector`](../selector)，本目录仅负责部门域的 API 接入、Chip/下拉条目渲染、部门树弹窗与懒加载 Hook。

## 目录结构

```
dept-selector/
├── index.ts                  # Barrel export
├── types.ts                  # 共享类型 & 常量
├── api.ts                    # API 层（部门树 & 搜索 & 单查）
├── DeptSelector.tsx          # 主组合组件（表单编辑）
├── DeptDisplay.tsx           # 纯展示组件（DeptDisplay + DeptListDisplay）
├── DeptChip.tsx              # 原子组件：可移除部门标签（DeptChip）+ 单选纯文本（DeptLabel）
├── DeptTreeModal.tsx         # 复合组件：部门树浏览弹窗（支持搜索 + 全选）
├── useDeptTree.ts            # Hook：懒加载部门树 + 模块级缓存
├── useDeptResolve.ts         # Hook：dept_id → DeptItem 自动回显
└── README.md                 # 本文档
```

## 🚨 必读：API 心智模型

### 唯一类型契约

| 入参                    | 类型                                          | 说明                                                                                  |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `deptId` / `deptIds` ⭐ | `string \| null` / `string[] \| null`         | **表单字段是 dept_id 字符串时优先用这个**，组件内部自动 `fetchDeptById` 回显（带模块级缓存） |
| `value`                 | `DeptItem \| DeptItem[] \| null`              | 已经持有完整 `DeptItem` 对象时才用                                                    |
| `onChange` ⚠️           | `(v: DeptItem \| DeptItem[] \| null) => void` | **回调收到的是完整 `DeptItem` 对象**（单选 `DeptItem \| null`，多选 `DeptItem[]`），不是 id 字符串 |

### 标准模板（对接 `formData.deptId: string`）

表单里只存 `dept_id` 字符串时，**首选 `deptId` 入参**，不要 `useState<DeptItem>`、不要 `as any` 硬拼伪对象：

```tsx
import { DeptSelector } from '@/components/dept-selector';
import type { DeptItem } from '@/types/department';

// 单选：表单只存 dept_id 字符串
<DeptSelector
  deptId={formData.deptId}
  onChange={(v) =>
    setFormData((p) => ({
      ...p,
      deptId: Array.isArray(v) ? "" : (v?.dept_id ?? ""),
    }))
  }
/>

// 多选：表单只存 dept_id 字符串数组
<DeptSelector
  multiple
  deptIds={formData.deptIds}
  onChange={(v) =>
    setFormData((p) => ({
      ...p,
      deptIds: Array.isArray(v) ? v.map((d) => d.dept_id) : [],
    }))
  }
/>
```

> 提交后端时表单字段就是字符串，无需额外转换。`deptId` 改变时组件会自动 fetch 拉详情，回显部门名。

### 四条铁律

1. **不要把字符串当 `value`**：`value` 收的是 `DeptItem` 对象，dept_id 字符串走 `deptId` 入参。
2. **不要硬拼 `{ dept_id, name: "" } as any`**：缺字段会让 UI 显示空白；让组件用 `deptId` 自己 fetch。
3. **不要给 `onChange` 加 `as any`**：参数类型是 `DeptItem | DeptItem[] | null`，单选时实际收到 `DeptItem | null`，用 `Array.isArray(v)` narrowing。
4. **`deptId` / `value` 都必须配 `onChange`**：永远不要写 `onChange={() => {}}` 或省略它，否则用户无法选择。

### 反例集

```tsx
// ❌ 1：硬拼伪 DeptItem 对象（用户最常见的错误）
//     name 为空 → UI 显示成空白；as any 让 TS 静默；下次 render 又新建对象，引用不稳定
<DeptSelector
  value={formData.deptId ? ({ dept_id: formData.deptId, name: "" } as any) : null}
  onChange={(dept: any) => setFormData({ ...formData, deptId: dept?.dept_id || "" })}
/>
// ✅ 改成：deptId 入参 + 类型化 onChange，组件自己 fetch 出部门名
<DeptSelector
  deptId={formData.deptId}
  onChange={(v) =>
    setFormData((p) => ({ ...p, deptId: Array.isArray(v) ? "" : (v?.dept_id ?? "") }))
  }
/>

// ❌ 2：把 dept_id 字符串直接当 value 传
<DeptSelector value={formData.deptId} onChange={(id) => /* ... */} />

// ❌ 3：传了 value 缺 onChange / onChange 是 noop
<DeptSelector value={dept} />
<DeptSelector deptId={formData.deptId} onChange={() => {}} />
```

## 导入

```tsx
// 主组件
import { DeptSelector } from '@/components/dept-selector';

// 展示组件
import { DeptDisplay, DeptListDisplay } from '@/components/dept-selector';

// 向后兼容（默认导出）
import DeptSelector from '@/components/dept-selector';

// 原子组件 / Hook / API
import {
  DeptChip,
  DeptLabel,
  DeptTreeModal,
  useDeptTree,
  useSingleDeptResolve,
  useMultiDeptResolve,
  fetchDeptTree,
  searchDepts,
  fetchDeptById,
} from '@/components/dept-selector';
```

## 其他用法

### 已持有 `DeptItem` 对象（受控对象写法）

外部已经能拿到完整 `DeptItem` 对象（如详情接口直接返回部门信息）时使用：

```tsx
// 单选
const [dept, setDept] = useState<DeptItem | null>(null);
<DeptSelector value={dept} onChange={setDept} />

// 多选
const [depts, setDepts] = useState<DeptItem[]>([]);
<DeptSelector multiple value={depts} onChange={setDepts} />
```

### 非受控（临时选择，外部不持值）

```tsx
<DeptSelector onChange={(dept) => console.log('选中:', !Array.isArray(dept) && dept?.name)} />
<DeptSelector multiple onChange={(depts) => console.log('选中部门数:', Array.isArray(depts) ? depts.length : 0)} />
```

### 只读 / 禁用

```tsx
<DeptSelector readOnly deptId="12345" onChange={() => {}} />
<DeptSelector disabled onChange={() => {}} />
```

### 纯展示（表格列 / 详情页，禁止直接渲染 dept_id）

```tsx
<DeptDisplay deptId={record.dept_id} />
<DeptListDisplay deptIds={record.dept_ids} />

// 展示完整部门路径
<DeptDisplay deptId={record.dept_id} showFullPath />
<DeptListDisplay deptIds={record.dept_ids} showFullPath maxDisplay={3} />
```

## Props 参考

### DeptSelector

| Prop          | 类型                                          | 默认值                   | 说明                             |
| ------------- | --------------------------------------------- | ------------------------ | -------------------------------- |
| `multiple`    | `boolean`                                     | `false`                  | 多选模式                                                       |
| `value`       | `DeptItem[] \| DeptItem \| null`              | —                        | 受控值，不传则内部自管理                                       |
| `onChange`    | `(v: DeptItem[] \| DeptItem \| null) => void` | **必填**                 | 值变更回调                                                     |
| `deptId`      | `string \| null`                              | —                        | 单选时只传 dept_id，组件内部自动 fetch 回显（与 value 二选一） |
| `deptIds`     | `string[] \| null`                            | —                        | 多选时只传 dept_id 数组，组件内部自动 fetch 回显（与 value 二选一） |
| `readOnly`    | `boolean`                                     | `false`                  | 只读模式                                                       |
| `placeholder` | `string`                                      | `'请输入关键字进行搜索'` | 输入框占位文本                                                 |
| `disabled`    | `boolean`                                     | `false`                  | 禁用交互                                                       |
| `className`   | `string`                                      | —                        | 根容器额外 CSS class                                           |

### DeptChip

多选场景下可移除的部门标签。`DeptListDisplay` 多选展示也复用该组件（`removable={false}`）。

| Prop         | 类型                    | 默认值   | 说明                       |
| ------------ | ----------------------- | -------- | -------------------------- |
| `department` | `DeptItem`              | **必填** | 部门数据                   |
| `removable`  | `boolean`               | `true`   | 是否显示移除按钮           |
| `onRemove`   | `(dept, event) => void` | —        | 移除回调                   |
| `className`  | `string`                | —        | 额外 CSS class             |

### DeptLabel

单选场景下的纯文本部门名展示（无 chip 背景、无 ×）。`DeptSelector` 只读单选 / `DeptDisplay` 都复用该组件。

| Prop           | 类型       | 默认值   | 说明                                                                  |
| -------------- | ---------- | -------- | --------------------------------------------------------------------- |
| `department`   | `DeptItem` | **必填** | 部门数据                                                              |
| `showFullPath` | `boolean`  | `false`  | 是否显示完整路径（`dept_full_path`），未返回时自动回落到 `name` |
| `className`    | `string`   | —        | 额外 CSS class                                                        |

### DeptDisplay

| Prop           | 类型                               | 默认值   | 说明                                                 |
| -------------- | ---------------------------------- | -------- | ---------------------------------------------------- |
| `deptId`       | `string \| null \| undefined`      | —        | 单个 dept_id，自动 fetch 展示                        |
| `showFullPath` | `boolean`                          | `false`  | 是否显示完整部门路径（接口未返回时自动回落到 name） |
| `className`    | `string`                           | —        | 额外 CSS class                                       |

### DeptListDisplay

| Prop           | 类型                                  | 默认值   | 说明                                                 |
| -------------- | ------------------------------------- | -------- | ---------------------------------------------------- |
| `deptIds`      | `string[] \| null \| undefined`       | —        | dept_id 数组，自动 fetch 展示                          |
| `showFullPath` | `boolean`                             | `false`  | 是否显示完整部门路径                                 |
| `maxDisplay`   | `number`                              | `5`      | 最多展示数量，超出显示 +N                          |
| `className`    | `string`                              | —        | 额外 CSS class                                       |

### DeptTreeModal

树浏览弹窗。特性：

- 窗口定高 `min(500px, 100vh-40px)`，左右面板可独立滚动
- 顶部搜索框复用 `searchDepts`，搜索期间左侧展示搜索结果
- 面包屑常驻显示，点击面包屑任一层可回退
- **多选模式下，只要左侧列表有值就在面包屑右侧展示「全选 / 取消全选」按钮**（包括搜索结果态、层级内部态），操作范围仅限当前可见列表
- 右侧已选项面板支持清空 / 单项移除
- 底部「确认」触发 `onConfirm(selected)`；「取消」触发 `onClose`

| Prop              | 类型                      | 默认值   | 说明                     |
| ----------------- | ------------------------- | -------- | ------------------------ |
| `open`            | `boolean`                 | **必填** | 是否打开弹窗             |
| `onClose`         | `() => void`              | **必填** | 关闭回调                 |
| `initialSelected` | `DeptItem[]`              | **必填** | 弹窗打开时的初始选中项   |
| `multiple`        | `boolean`                 | `false`  | 多选模式                 |
| `onConfirm`       | `(selected) => void`      | **必填** | 确认回调                 |

## Hooks

### useDeptTree()

懒加载部门树导航，**内置模块级缓存**：同一 `deptId` 的子节点只会请求一次，后续切换层级直接复用缓存。

返回值：

```ts
const {
  currentNodes,      // 当前层级的子节点
  breadcrumbStack,   // 从根到当前层级的面包屑路径
  loading,           // 是否正在加载子节点
  loadChildren,      // 加载指定部门的子节点（'-1' 为根）
  navigateInto,      // 进入子部门
  navigateBack,      // 返回到面包屑某一层级
  resetTree,         // 重置回根节点
} = useDeptTree();
```

### clearDeptTreeCache()

清空模块级部门树缓存（从 `./useDeptTree` 导出）。测试或需要强制刷新树数据时使用。

### useSingleDeptResolve(deptId, currentValue, onResolved)

当 `deptId` 变化且当前值与之不匹配时，自动调用 `fetchDeptById` 将 `deptId` 解析为 `DeptItem` 对象并回传（供 `DeptDisplay` / 自定义表单使用）。

### useMultiDeptResolve(deptIds, currentValue, onResolved)

多选版本：自动将 `deptIds` 数组解析为 `DeptItem[]` 用于回显。

### clearDeptDetailCache()

清空通过 `fetchDeptById` 建立的详情缓存（从 `./useDeptResolve` 导出）。

## API 函数

### fetchDeptTree(deptId?: string): Promise\<GetDeptTreeResponse\>

获取指定部门节点的直接子节点（懒加载树），`deptId` 默认 `'-1'`（根节点）。Mock 实现带 500ms 网络延迟以便观察 loading 与缓存效果。

### searchDepts(query, offset?, limit?): Promise\<SearchApiResult\<DeptItem\>\>

按关键字搜索部门，返回统一的 `{ has_more, offset, total, items }` 结构，可直接作为 `@/components/selector` 中 `useSearch` / `Selector` 的 `searchApi` 使用。

### fetchDeptById(deptId: string): Promise\<DeptItem | null\>

根据 `dept_id` 获取单个部门详情（GET `/api/depts/:deptId`），请求失败时返回 `null`。`DeptDisplay` / `DeptListDisplay` 内部基于它实现。

## 与通用 Selector 的关系

`DeptSelector` 通过传入 `searchApi={searchDepts}`、`renderChip` 和 `renderDropdownItem` 使用 `@/components/selector` 下的通用 `Selector`，无需自行实现防抖搜索、下拉开闭与滚动加载。

多选/单选的选中标识统一为：

- 多选：`@/components/ui/checkbox` 的 shadcn `Checkbox`
- 单选：`lucide-react` 的 `Check` 图标（未选中时通过 `opacity-0` 保持布局稳定）

颜色一律使用 shadcn 语义化 tailwind token（`text-foreground` / `text-muted-foreground` / `bg-primary` / `bg-accent` / `border-border` / `border-input` 等），随主题自动切换。
