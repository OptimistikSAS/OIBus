import React from 'react'
import PropTypes from 'prop-types'
import { FaTrashAlt, FaCog, FaCopy, FaLongArrowAltDown, FaLongArrowAltUp } from 'react-icons/fa'
import StatusButton from '../../StatusButton.jsx'
import Modal from '../Modal.jsx'

const TableRows = ({ rows, handleEdit, handleStatus, handleDelete, handleDuplicate, handleOrder }) => (
  <tbody>
    {rows.map((row, index) => (
      <tr key={row[0].name}>
        {handleOrder && (
        <td>
          <FaLongArrowAltDown
            className="oi-arrow-up-down"
            size={15}
            onClick={(e) => {
              e.preventDefault()
              handleOrder('down', index)
            }}
          />
          <FaLongArrowAltUp
            className="oi-arrow-up-down"
            size={15}
            onClick={(e) => {
              e.preventDefault()
              handleOrder('up', index)
            }}
          />
        </td>
        )}
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
            <Modal
              show={false}
              title="Delete"
              body={`Are you sure you want to delete ${row[0].name}?`}
            >
              {(confirm) => (
                <FaTrashAlt
                  className="oi-icon"
                  onClick={confirm(() => {
                    handleDelete(index)
                  })}
                />
              )}
            </Modal>
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
  handleOrder: PropTypes.func,
}

TableRows.defaultProps = { handleDelete: null, handleEdit: null, handleStatus: null, handleDuplicate: null, handleOrder: null }

export default TableRows
