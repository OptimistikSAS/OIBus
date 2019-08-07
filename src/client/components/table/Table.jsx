import React from 'react'
import PropTypes from 'prop-types'
import { Table as BsTable } from 'reactstrap'

import TableHeader from './TableHeader.jsx'
import TableRows from './TableRows.jsx'

const Table = ({ headers, rows, onRowClick, handleAdd, handleDelete }) => (
  <BsTable striped hover size="sm">
    <TableHeader headers={headers} handleAdd={handleAdd} />
    <TableRows rows={rows} onRowClick={onRowClick} handleDelete={handleDelete} />
  </BsTable>
)

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired,
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func.isRequired,
  handleAdd: PropTypes.func,
  handleDelete: PropTypes.func,
}

Table.defaultProps = { handleAdd: null, handleDelete: null }

export default Table
