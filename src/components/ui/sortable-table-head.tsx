import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table.tsx';
import { SortConfig, useSortableTable } from '@/hooks/useSortableTable.ts';
import { cn } from '@/lib/utils.ts';

interface SortableTableHeadProps<T> extends React.ThHTMLAttributes<HTMLTableCellElement> {
  field: keyof T;
  sortConfig: SortConfig<T>;
  onRequestSort: (field: keyof T) => void;
  children: React.ReactNode;
}

export function SortableTableHead<T>({ 
  field, 
  sortConfig, 
  onRequestSort, 
  children,
  className,
  ...props
}: SortableTableHeadProps<T>) {
  const isSorted = sortConfig.key === field;
  const direction = isSorted ? sortConfig.direction : null;

  return (
    <TableHead 
      className={cn("cursor-pointer select-none group", className)}
      onClick={() => onRequestSort(field)}
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="text-gray-400 group-hover:text-gray-600 transition-colors">
          {direction === 'asc' ? (
            <ArrowUp className="h-4 w-4 text-primary" />
          ) : direction === 'desc' ? (
            <ArrowDown className="h-4 w-4 text-primary" />
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          )}
        </span>
      </div>
    </TableHead>
  );
}

interface SortableWrapperProps<T> {
  items: T[];
  render: (
    sortedItems: T[],
    sortConfig: SortConfig<T>,
    requestSort: (field: keyof T) => void
  ) => React.ReactNode;
}

export function SortableWrapper<T>({ items, render }: SortableWrapperProps<T>) {
  const { sortedItems, sortConfig, requestSort } = useSortableTable(items);
  return <>{render(sortedItems, sortConfig, requestSort)}</>;
}
