import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

type DataTableProps<T> = {
  data: T[]
  columns: ColumnDef<T>[]
  emptyLabel: string
}

export function DataTable<T>({ data, columns, emptyLabel }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-auto rounded-lg border border-[#dfe3dc] bg-white">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                return (
                  <th className="border-b border-[#edf0eb] bg-[#fbfcfa] px-3.5 py-3 text-left align-middle text-[13px] text-[#4f5d54]" key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder ? null : (
                      <button
                        className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 font-bold text-inherit disabled:cursor-default"
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? <ArrowUp size={14} /> : sorted === 'desc' ? <ArrowDown size={14} /> : <ChevronsUpDown size={14} />}
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td className="border-b border-[#edf0eb] px-3.5 py-3 text-left align-middle" key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          )) : (
            <tr><td className="px-3.5 py-7 text-center text-[#66746b]" colSpan={columns.length}>{emptyLabel}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
