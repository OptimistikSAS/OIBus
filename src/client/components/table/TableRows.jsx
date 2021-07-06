import React from 'react'
import PropTypes from 'prop-types'
import { FaTrashAlt, FaCog, FaCopy } from 'react-icons/fa'
import StatusButton from '../../South/StatusButton.jsx'

const TableRows = ({ rows, handleEdit, handleStatus, handleDelete, handleDuplicate }) => (
  <tbody>
    {rows.map((row, index) => (
      <tr key={row[0].name}>
        {row.map((field) => (
          <td key={field.name} style={{ width: field.value.props?.width ?? '' }}>{field.value}</td>
        ))}
        <td>
          {handleEdit && (
            <FaCog
              className="oi-icon"
              onClick={(e) => {
                e.preventDefault()
                handleEdit(index)
              }}
            />
          )}
          {handleStatus && (
            <StatusButton handler={() => handleStatus(index)} isIcon />
          )}
          {handleDuplicate && (
            <FaCopy
              className="oi-icon"
              onClick={(e) => {
                e.preventDefault()
                handleDuplicate(index)
              }}
            />
          )}
          {handleDelete && (
            <FaTrashAlt
              className="oi-icon"
              onClick={(e) => {
                e.preventDefault()
                handleDelete(index)
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
  handleStatus: PropTypes.func,
  handleDelete: PropTypes.func,
  handleDuplicate: PropTypes.func,
}

TableRows.defaultProps = { handleDelete: null, handleEdit: null, handleStatus: null, handleDuplicate: null }

export default TableRows
