import React from 'react'
import PropTypes from 'prop-types'
import { FaPlusCircle } from 'react-icons/fa'

const TableHeader = ({ headers, handleAdd, handleDelete }) => {
  const decoratedHeaders = headers
  if (handleAdd) {
    decoratedHeaders[0] = ( // add Icon in the header
      <>
        <FaPlusCircle className="oi-icon" onClick={handleAdd} />
        <span>{headers[0]}</span>
      </>
    )
  }
  if (handleDelete) {
    decoratedHeaders.push('') // add column for the delete icon
    // headers.push('actions') // used for the unique key
  }

  return (
    <thead>
      <tr>
        {decoratedHeaders.map((decoratedHeader, index) => (
          <th key={headers[index]} scope="col">
            {decoratedHeader}
          </th>
        ))}
      </tr>
    </thead>
  )
}

TableHeader.propTypes = {
  headers: PropTypes.PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired,
  handleAdd: PropTypes.func,
  handleDelete: PropTypes.func,
}
TableHeader.defaultProps = { handleAdd: null, handleDelete: null }

export default TableHeader
