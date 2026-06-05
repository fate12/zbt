import { useCallback, useState } from 'react';
import type { DeptItem } from '@/types/department';
import type { DeptSelectorProps } from './types';
import { Selector } from '@/components/selector';
import { Checkbox } from '@/components/ui/checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchDepts } from './api';
import { DeptChip, DeptLabel } from './DeptChip';
import { DeptTreeModal } from './DeptTreeModal';
import { useSingleDeptResolve, useMultiDeptResolve } from './useDeptResolve';

// ============================================================
// DeptSelector — 部门选择器
//
// 支持单选/多选、受控/非受控、只读模式。
// 基于通用 Selector 组件，搜索/下拉由 Selector 统一提供；
// 本组件只负责：部门 API 接入、Chip 渲染、下拉条目渲染、部门树弹窗、dept_id 自动解析。
// ============================================================

/** 根据 multiple 标准化外部传入的 value 为内部统一的数组形式 */
function normalizeValue(
  propValue: DeptItem[] | DeptItem | null | undefined,
  fallback: DeptItem[],
): DeptItem[] {
  if (propValue === undefined || propValue === null) return fallback || [];
  return Array.isArray(propValue) ? propValue : [propValue];
}

export function DeptSelector(props: DeptSelectorProps) {
  const {
    multiple = false,
    value,
    onChange,
    deptId,
    deptIds,
    readOnly = false,
    placeholder = '请输入关键字进行搜索',
    disabled = false,
    className,
  } = props;

  // ---- 内部状态（非受控模式） ----
  const [internalItems, setInternalItems] = useState<DeptItem[]>([]);
  const items = normalizeValue(value, internalItems);

  const emitChange = useCallback(
    (nextItems: DeptItem[]) => {
      setInternalItems(nextItems);
      if (multiple) {
        onChange(nextItems);
      } else {
        onChange(nextItems[0] ?? null);
      }
    },
    [multiple, onChange],
  );

  // ---- 通过 deptId / deptIds 自动解析 ----
  const singleResolveValue = !multiple ? (items[0] ?? null) : null;
  const singleResolveCallback = useCallback(
    (detail: DeptItem | null) => {
      emitChange(detail ? [detail] : []);
    },
    [emitChange],
  );
  useSingleDeptResolve(
    !multiple ? (deptId ?? null) : null,
    singleResolveValue,
    singleResolveCallback,
  );

  const multiResolveCallback = useCallback(
    (details: DeptItem[]) => {
      emitChange(details);
    },
    [emitChange],
  );
  useMultiDeptResolve(
    multiple ? (deptIds ?? null) : null,
    multiple ? items : [],
    multiResolveCallback,
  );

  // ---- 弹窗状态 ----
  const [modalOpen, setModalOpen] = useState(false);

  function handleModalConfirm(selected: DeptItem[]) {
    emitChange(selected);
    setModalOpen(false);
  }

  return (
    <>
      <Selector<DeptItem>
        getItemId={(department) => department?.dept_id || ''}
        getItemLabel={(department) => department?.name || ''}
        items={items}
        onItemsChange={emitChange}
        multiple={multiple}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={className}
        searchApi={searchDepts}
        dropdownEmptyText="未找到匹配部门"
        dropdownPlaceholderText="输入关键字搜索部门"
        renderChip={(department, onRemove, isReadOnly) => (
          <DeptChip
            key={department?.dept_id || ''}
            department={department}
            removable={!isReadOnly}
            onRemove={(dept, event) => onRemove(dept, event)}
          />
        )}
        renderReadOnlySingle={(department) => (
          <DeptLabel department={department} />
        )}
        renderDropdownItem={(department, { selected }) => (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="text-sm text-foreground truncate flex-1">
              {department?.name || ''}
            </span>
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
        extraActions={
          <button
            type="button"
            className="flex items-center justify-center h-7 w-7 shrink-0 self-center text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              if (disabled) return;
              setModalOpen(true);
            }}
          >
            <TreeIcon />
          </button>
        }
      />

      {/* 部门树弹窗 */}
      <DeptTreeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialSelected={items}
        multiple={multiple}
        onConfirm={handleModalConfirm}
      />
    </>
  );
}

// ---- 图标 ----

/** 部门树图标，dept-selector 模块内共享。 */
export function TreeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 -3 20 20"
      fill="none"
      className={cn('block', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 2V7M10 7H5M10 7H15M5 7V11M15 7V11M5 11H3V14H7V11H5ZM15 11H13V14H17V11H15Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <rect x="8" y="1" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default DeptSelector;
