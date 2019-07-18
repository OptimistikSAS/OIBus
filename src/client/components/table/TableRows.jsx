import React from 'react'
import PropTypes from 'prop-types'

const TableRows = ({ rows, onRowClick }) => (
  <tbody>
    {rows.map((row) => (
      <tr key={row[0].value} onClick={() => onRowClick(row)}>
        {row.map((field) => <td key={field.name}>{field.value}</td>)}
      </tr>
    ))}
  </tbody>
)

TableRows.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func.isRequired,
}

export default TableRows
