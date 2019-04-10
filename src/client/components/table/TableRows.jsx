import React from 'react'
import PropTypes from 'prop-types'

const TableRows = ({ rows, onRowClick }) => (
  <tbody>
    {rows.map((row, index) => (
      <tr className="oi-row" key={index.toString()} onClick={() => onRowClick(row)}>
        <th scope="row">{index + 1}</th>
        {row.map((field, fieldIndex) => (
          <td key={fieldIndex.toString()}>{field}</td>
        ))}
      </tr>
    ))}
  </tbody>
)

TableRows.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func.isRequired,
}

export default TableRows
