const columns = ['ID', 'Name', 'Email', 'Department', 'Branch', 'Status']

export function EmployeeTableHeader() {
  return (
    <thead className="prominent-gradient border-b border-gray-200">
      <tr>
        {columns.map((col) => (
          <th
            key={col}
            className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}
