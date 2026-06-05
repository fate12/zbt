import type { DeptItem } from '@/types/department';

// ============================================================
// DeptSelector — 共享类型与常量
// ============================================================

export interface DeptSelectorProps {
  /** 是否多选模式 */
  multiple?: boolean;

  /**
   * 受控值。**单选传 `DeptItem | null`，多选传 `DeptItem[]`**。
   *
   * ⚠️ 表单只存 `dept_id` 字符串时不要走这里，**改用下面的 `deptId` / `deptIds`** 入参，组件会自动拉 `fetchDeptById` 回显。
   * 表单存的已是完整 `DeptItem` 对象时才用 `value` + `onChange`，例：
   *   ```tsx
   *   const [dept, setDept] = useState<DeptItem | null>(null);
   *   <DeptSelector value={dept} onChange={setDept} />
   *   ```
   *
   * ❌ 反例（都不要这么写）：
   *   - `value={formData.deptId}`                                  // string 不是 DeptItem
   *   - `value={{ dept_id: formData.deptId, name: '' } as any}`     // 硬拼伪对象 → UI 显示空白
   *   - `value={[{ dept_id: formData.deptId } as DeptItem]}`        // 单选不是数组；且缺字段
   */
  value?: DeptItem[] | DeptItem | null;

  /**
   * 值变化回调。**单选时实际收到 `DeptItem | null`，多选时收到 `DeptItem[]`**。
   * TS 类型是 union，请用 `Array.isArray(v)` 运行时 narrowing，不要 `as any`。
   */
  onChange: (value: DeptItem[] | DeptItem | null) => void;

  /**
   * ⭐ **表单只存 dept_id 字符串时首选这个**（单选）。
   * 组件内部会自动 `fetchDeptById` 拉详情回显（带模块级缓存），无需你自己拼 DeptItem 对象。
   *
   * 例：
   *   ```tsx
   *   <DeptSelector
   *     deptId={formData.deptId}
   *     onChange={(v) =>
   *       setFormData((p) => ({ ...p, deptId: Array.isArray(v) ? '' : (v?.dept_id ?? '') }))
   *     }
   *   />
   *   ```
   *
   * 上游已能拿到完整 `DeptItem` 对象时，可以同时传 `deptId` + `value`，优先以 `value` 为准。
   */
  deptId?: string | null;

  /**
   * ⭐ **表单只存 dept_id 字符串数组时首选这个**（多选）。
   * 组件内部并发拉多个部门详情、并过滤 null。
   *
   * 例：
   *   ```tsx
   *   <DeptSelector
   *     multiple
   *     deptIds={formData.deptIds}
   *     onChange={(v) =>
   *       setFormData((p) => ({ ...p, deptIds: Array.isArray(v) ? v.map((d) => d.dept_id) : [] }))
   *     }
   *   />
   *   ```
   */
  deptIds?: string[] | null;

  /** 只读模式 */
  readOnly?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** 根容器额外 CSS class */
  className?: string;
}

// ---- 常量 ----

export const SEARCH_DEBOUNCE_MS = 300;
export const DEFAULT_SEARCH_LIMIT = 50;
