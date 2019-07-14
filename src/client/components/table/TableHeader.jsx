import React from 'react'
import PropTypes from 'prop-types'

const TableHeader = ({ headers }) => (
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

TableHeader.propTypes = { headers: PropTypes.PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired }


export default TableHeader
