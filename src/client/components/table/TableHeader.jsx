import React from 'react'
import PropTypes from 'prop-types'
import { FaPlusCircle } from 'react-icons/fa'

const TableHeader = ({ headers, handleAdd }) => {
  if (handleAdd) {
    headers[0] = ( // add Icon in the header
      <>
        <FaPlusCircle className="oi-icon" onClick={handleAdd} />
        <span>{headers[0]}</span>
      </>
    )
    headers.push('') // add column for the delete icon
  }
  return (
    <thead>
      <tr>
        {headers.map((header) => (
          <th key={typeof header === 'object' ? header.key : header} scope="col">
            {header}
          </th>
        ))}
      </tr>
    </thead>
  )
}

TableHeader.propTypes = {
  headers: PropTypes.PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired,
  handleAdd: PropTypes.func,
}
TableHeader.defaultProps = { handleAdd: null }

export default TableHeader
