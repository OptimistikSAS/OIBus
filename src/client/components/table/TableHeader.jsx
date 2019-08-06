import React from 'react'
import PropTypes from 'prop-types'
import { FaPlusCircle } from 'react-icons/fa'

const TableHeader = ({ headers, actions }) => {
  if (actions) {
    headers[0] = ( // add Icon in the header
      <>
        <FaPlusCircle className="oi-icon" />
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
  actions: PropTypes.bool,
}
TableHeader.defaultProps = { actions: false }

export default TableHeader
