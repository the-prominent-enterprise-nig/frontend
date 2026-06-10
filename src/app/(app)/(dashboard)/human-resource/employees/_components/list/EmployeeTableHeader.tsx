const columns = ['ID', 'Name', 'Email', 'Department', 'Branch', 'Status']

export function EmployeeTableHeader({ showActions = true }: { showActions?: boolean }) {
  return (
    <thead className="prominent-gradient border-b border-gray-200">
      <tr>
        {[...columns, ...(showActions ? ['Actions'] : [])].map((col) => (
          <th
            key={col}
            className={`px-6 py-3 text-xs font-medium text-white uppercase tracking-wider ${
              col === 'Actions' ? 'text-center' : 'text-left'
            }`}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}
