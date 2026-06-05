import type { Employee } from '@/types/contacts';

// ============================================================
// EmployeeSelector — 共享类型与常量
// ============================================================

export interface EmployeeSelectorProps {
  /** 是否多选模式 */
  multiple?: boolean;

  /**
   * 受控值。**单选传 `Employee | null`，多选传 `Employee[]`**。
   *
   * ⚠️ 表单只存 `emp_id` 字符串时不要走这里，**改用下面的 `empId` / `empIds`** 入参，组件会自动拉 `fetchEmployeeById` 回显。
   * 表单存的已是完整 `Employee` 对象时才用 `value` + `onChange`，例：
   *   ```tsx
   *   const [emp, setEmp] = useState<Employee | null>(null);
   *   <EmployeeSelector value={emp} onChange={setEmp} />
   *   ```
   *
   * ❌ 反例（都不要这么写）：
   *   - `value={formData.empId}`                                   // string 不是 Employee
   *   - `value={{ emp_id: formData.empId, name: '' } as any}`       // 硬拼伪对象 → UI 显示空白
   *   - `value={[{ emp_id: formData.empId } as Employee]}`          // 单选不是数组；且缺字段
   */
  value?: Employee[] | Employee | null;

  /**
   * 值变化回调。**单选时实际收到 `Employee | null`，多选时收到 `Employee[]`**。
   * TS 类型是 union，请用 `Array.isArray(v)` 运行时 narrowing，不要 `as any`。
   */
  onChange: (value: Employee[] | Employee | null) => void;

  /**
   * ⭐ **表单只存 emp_id 字符串时首选这个**（单选）。
   * 组件内部会自动 `fetchEmployeeById` 拉详情回显（带模块级缓存），无需你自己拼 Employee 对象。
   *
   * 例：
   *   ```tsx
   *   <EmployeeSelector
   *     empId={formData.empId}
   *     onChange={(v) =>
   *       setFormData((p) => ({ ...p, empId: Array.isArray(v) ? '' : (v?.emp_id ?? '') }))
   *     }
   *   />
   *   ```
   *
   * 上游已能拿到完整 `Employee` 对象时，可以同时传 `empId` + `value`，优先以 `value` 为准。
   */
  empId?: string | null;

  /**
   * ⭐ **表单只存 emp_id 字符串数组时首选这个**（多选）。
   * 组件内部并发拉多个员工详情、并过滤 null。
   *
   * 例：
   *   ```tsx
   *   <EmployeeSelector
   *     multiple
   *     empIds={formData.empIds}
   *     onChange={(v) =>
   *       setFormData((p) => ({ ...p, empIds: Array.isArray(v) ? v.map((e) => e.emp_id) : [] }))
   *     }
   *   />
   *   ```
   */
  empIds?: string[] | null;

  /** 只读模式 */
  readOnly?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** 根容器额外 CSS class */
  className?: string;
}

// ---- 常量 ----

export const SEARCH_DEBOUNCE_MS = 300;
export const DEFAULT_PAGE_LIMIT = 20;
