import React from 'react'
import PropTypes from 'prop-types'
import { FaTrashAlt, FaPencilAlt } from 'react-icons/fa'
import { Button } from 'reactstrap'

const TableRows = ({ rows, handleEdit, handleDelete }) => (
  <tbody>
    {rows.map((row, index) => (
      <tr key={row[0].name}>
        {row.map((field) => (
          <td key={field.name}>{field.value}</td>
        ))}
        <td>
          {handleDelete && (
            <Button close>
              <FaTrashAlt
                className="oi-icon"
                onClick={(e) => {
                  e.preventDefault()
                  handleDelete(index)
                }}
              />
            </Button>
          )}
          {handleEdit && (
            <Button close>
              <FaPencilAlt
                className="oi-icon"
                onClick={(e) => {
                  e.preventDefault()
                  handleEdit(index)
                }}
              />
            </Button>
          )}
        </td>
      </tr>
    ))}
  </tbody>
)

TableRows.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  handleEdit: PropTypes.func,
  handleDelete: PropTypes.func,
}

TableRows.defaultProps = { handleDelete: null, handleEdit: null }

export default TableRows
