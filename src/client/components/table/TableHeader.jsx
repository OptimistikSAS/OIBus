import React from 'react'
import PropTypes from 'prop-types'

const TableHeader = ({ headers }) => (
  <thead>
    <tr>
      <th scope="col">#</th>
      {headers.map(header => (
        <th key={header} scope="col">
          {header}
        </th>
      ))}
    </tr>
  </thead>
)

TableHeader.propTypes = { headers: PropTypes.PropTypes.arrayOf(PropTypes.string).isRequired }

export default TableHeader
