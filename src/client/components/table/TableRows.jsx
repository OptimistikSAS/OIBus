import React from 'react'
import PropTypes from 'prop-types'
import { FaTrashAlt, FaCog } from 'react-icons/fa'

const TableRows = ({ rows, handleEdit, handleDelete }) => (
  <tbody>
    {rows.map((row, index) => (
      <tr key={row[0].name}>
        {row.map((field) => (
          <td key={field.name}>{field.value}</td>
        ))}
        <td>
          {handleDelete && (
            <FaTrashAlt
              className="oi-icon"
              onClick={(e) => {
                e.preventDefault()
                handleDelete(index)
              }}
            />
          )}
          {handleEdit && (
            <FaCog
              className="oi-icon"
              onClick={(e) => {
                e.preventDefault()
                handleEdit(index)
              }}
            />
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
