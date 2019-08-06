import React from 'react'
import PropTypes from 'prop-types'
import { FaTrashAlt } from 'react-icons/fa'
import { Button } from 'reactstrap'

const TableRows = ({ rows, onRowClick, actions }) => (
  <tbody>
    {rows.map((row) => (
      <tr key={row[0].name} onClick={() => onRowClick(row)}>
        {row.map((field) => (
          <td key={field.name}>{field.value}</td>
        ))}
        {actions && (
          <td>
            <Button close>
              <FaTrashAlt className="oi-icon" />
            </Button>
          </td>
        )}
      </tr>
    ))}
  </tbody>
)

TableRows.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func.isRequired,
  actions: PropTypes.bool,
}

TableRows.defaultProps = { actions: false }

export default TableRows
