import React from 'react'
import PropTypes from 'prop-types'
import {
  FaTrashAlt,
  FaCog,
  FaCopy,
  FaLongArrowAltDown,
  FaLongArrowAltUp,
} from 'react-icons/fa'
import StatusButton from '../../StatusButton.jsx'
import Modal from '../Modal.jsx'

const UpIcon = ({ handleOrder, index }) => (
  <FaLongArrowAltUp
    className="oi-arrow-up-down"
    size={15}
    onClick={(e) => {
      e.preventDefault()
      handleOrder('up', index)
    }}
  />
)

const DownIcon = ({ handleOrder, index }) => (
  <FaLongArrowAltDown
    className="oi-arrow-up-down"
    size={15}
    onClick={(e) => {
      e.preventDefault()
      handleOrder('down', index)
    }}
  />
)

const renderUpDownIcon = (handleOrder, listLength, indexInList) => {
  if (listLength === 1) return null
  if (listLength !== 1 && indexInList === 0) {
    return <DownIcon handleOrder={handleOrder} index={indexInList} />
  }
  if (listLength !== 1 && indexInList === listLength - 1) {
    return <UpIcon handleOrder={handleOrder} index={indexInList} />
  }

  return (
    <>
      <DownIcon handleOrder={handleOrder} index={indexInList} />
      <UpIcon handleOrder={handleOrder} index={indexInList} />
    </>
  )
}

const TableRows = ({
  rows,
  handleEdit,
  handleStatus,
  handleDelete,
  handleDuplicate,
  handleOrder,
  isHistoryQuery,
}) => (
  <tbody>
    {rows.map((row, index) => (
      <tr key={row[0].name}>
        {handleOrder && (
          <td>{renderUpDownIcon(handleOrder, rows.length, index)}</td>
        )}
        {row.map((field) => (
          <td
            key={field.name}
            style={{ width: field.value.props?.width ?? '' }}
            className="align-top"
          >
            {field.value}
          </td>
        ))}
        <td className="align-center">
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
              body={`Are you sure you want to delete ${isHistoryQuery ? row[1].value : row[0].value.props.value}?`}
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
  rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
  handleEdit: PropTypes.func,
  handleStatus: PropTypes.func,
  handleDelete: PropTypes.func,
  handleDuplicate: PropTypes.func,
  handleOrder: PropTypes.func,
  isHistoryQuery: PropTypes.bool,
}

DownIcon.propTypes = {
  handleOrder: PropTypes.func.isRequired,
  index: PropTypes.number.isRequired,
}

UpIcon.propTypes = {
  handleOrder: PropTypes.func.isRequired,
  index: PropTypes.number.isRequired,
}

TableRows.defaultProps = {
  handleDelete: null,
  handleEdit: null,
  handleStatus: null,
  handleDuplicate: null,
  handleOrder: null,
  isHistoryQuery: false,
}

export default TableRows
