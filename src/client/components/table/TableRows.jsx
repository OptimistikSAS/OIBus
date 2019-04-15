import React from 'react'
import PropTypes from 'prop-types'

const TableRows = ({ rows, onRowClick }) => {
  let counter = 0

  const getCounter = () => {
    counter += 1
    return counter
  }
  return (
    <tbody>
      {rows.map(row => (
        <tr key={row[0]} onClick={() => onRowClick(row)}>
          {row.map(field => (
            <td key={`${`${getCounter()}-${field}`}-${field}`}>{field}</td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

TableRows.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func.isRequired,
}

export default TableRows
