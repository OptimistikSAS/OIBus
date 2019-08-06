import React from 'react'
import PropTypes from 'prop-types'
import { Table as BsTable } from 'reactstrap'

import TableHeader from './TableHeader.jsx'
import TableRows from './TableRows.jsx'

const Table = ({ headers, rows, onRowClick, actions }) => (
  <BsTable striped hover size="sm">
    <TableHeader headers={headers} actions={actions} />
    <TableRows rows={rows} onRowClick={onRowClick} actions={actions} />
  </BsTable>
)

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired,
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func.isRequired,
  actions: PropTypes.bool,
}

Table.defaultProps = { actions: false }

export default Table
