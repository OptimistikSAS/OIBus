import React from 'react'
import PropTypes from 'prop-types'
import { FaTrashAlt } from 'react-icons/fa'
import { Button } from 'reactstrap'

const TableRows = ({ rows, onRowClick, handleDelete }) => (
  <tbody>
    {rows.map((row, index) => (
      <tr key={row[0].name} onClick={() => onRowClick(row)}>
        {row.map((field) => (
          <td key={field.name}>{field.value}</td>
        ))}
        {handleDelete && (
          <td>
            <Button close>
              <FaTrashAlt
                className="oi-icon"
                onClick={(e) => {
                  e.preventDefault()
                  handleDelete(index)
                }}
              />
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
  handleDelete: PropTypes.func,
}

TableRows.defaultProps = { handleDelete: null }

export default TableRows
