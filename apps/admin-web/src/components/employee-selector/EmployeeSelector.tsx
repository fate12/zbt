import { useCallback, useState } from 'react';
import type { Employee } from '@/types/contacts';
import type { EmployeeSelectorProps } from './types';
import { Selector } from '@/components/selector';
import { Checkbox } from '@/components/ui/checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmployeeAvatar } from './EmployeeAvatar';
import { EmployeeChip, EmployeeLabel } from './EmployeeChip';
import { searchEmployees } from './api';
import { useSingleEmployeeResolve, useMultiEmployeeResolve } from './useEmployeeResolve';

// ============================================================
// EmployeeSelector — 人员选择器
//
// 支持单选/多选、受控/非受控、只读模式。
// 基于通用 Selector 组件，搜索/下拉由 Selector 统一提供；
// 本组件只负责：人员 API 接入、Chip 渲染、下拉条目渲染、emp_id 自动解析。
// ============================================================

/** 根据 multiple 标准化外部传入的 value 为内部统一的数组形式 */
function normalizeValue(
  propValue: Employee[] | Employee | null | undefined,
  fallback: Employee[],
): Employee[] {
  if (propValue === undefined || propValue === null) return fallback || [];
  return Array.isArray(propValue) ? propValue : [propValue];
}

export function EmployeeSelector(props: EmployeeSelectorProps) {
  const {
    multiple = false,
    onChange,
    empId,
    empIds,
    readOnly = false,
    placeholder = '搜索人员',
    disabled = false,
    className,
  } = props;

  // ---- 内部状态（非受控模式） ----
  const [internalItems, setInternalItems] = useState<Employee[]>([]);
  const items = normalizeValue(props.value, internalItems);

  const emitChange = useCallback(
    (nextItems: Employee[]) => {
      setInternalItems(nextItems);
      if (multiple) {
        onChange(nextItems);
      } else {
        onChange(nextItems[0] ?? null);
      }
    },
    [multiple, onChange],
  );

  // ---- 通过 userId / userIds 自动解析 ----
  const singleResolveValue = !multiple ? (items[0] ?? null) : null;
  const singleResolveCallback = useCallback(
    (employee: Employee | null) => {
      emitChange(employee ? [employee] : []);
    },
    [emitChange],
  );
  useSingleEmployeeResolve(
    !multiple ? (empId ?? null) : null,
    singleResolveValue,
    singleResolveCallback,
  );

  const multiResolveCallback = useCallback(
    (employees: Employee[]) => {
      emitChange(employees);
    },
    [emitChange],
  );
  useMultiEmployeeResolve(
    multiple ? (empIds ?? null) : null,
    multiple ? items : [],
    multiResolveCallback,
  );

  // ---- 渲染 ----
  return (
    <Selector<Employee>
      getItemId={(employee) => employee?.emp_id || ''}
      getItemLabel={(employee) => employee?.name || ''}
      items={items}
      onItemsChange={emitChange}
      multiple={multiple}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      className={className}
      searchApi={searchEmployees}
      dropdownEmptyText="未找到匹配人员"
      dropdownPlaceholderText="输入姓名搜索"
      renderChip={(employee, onRemove, isReadOnly) => (
        <EmployeeChip
          key={employee?.emp_id || ''}
          employee={employee}
          removable={!isReadOnly}
          onRemove={(emp, event) => onRemove(emp, event)}
        />
      )}
      renderReadOnlySingle={(employee) => (
        <EmployeeLabel employee={employee} size={24} />
      )}
      renderDropdownItem={(employee, { selected }) => (
        <div className="flex items-center gap-3 px-3 py-2">
          <EmployeeAvatar employee={employee} size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{employee?.name || ''}</span>
              {employee?.title && (
                <span className="text-xs text-muted-foreground truncate">
                  {employee.title}
                </span>
              )}
            </div>
            {employee?.dept_id_list && employee.dept_id_list.length > 0 && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                部门ID: {employee.dept_id_list[0]}
              </div>
            )}
          </div>
          {multiple ? (
            <Checkbox checked={selected} className="pointer-events-none" />
          ) : (
            <Check
              className={cn(
                'h-4 w-4 shrink-0 text-primary',
                selected ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}
        </div>
      )}
    />
  );
}
