import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'

const TableRows = ({ rows, onRowClick, onDeleteClick }) => {
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
          <td key={getCounter() - 'delete'}>
            <Button color="danger" onClick={event => onDeleteClick(event, row[0])}>
              Delete
            </Button>
          </td>
        </tr>
      ))}
    </tbody>
  )
}

TableRows.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func.isRequired,
  onDeleteClick: PropTypes.func.isRequired,
}

export default TableRows
