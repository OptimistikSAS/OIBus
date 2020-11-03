import React from 'react'
import PropTypes from 'prop-types'
import { Table as BsTable } from 'reactstrap'

import TableHeader from './TableHeader.jsx'
import TableRows from './TableRows.jsx'

const Table = ({ headers, rows, handleAdd, handleDelete, handleEdit, handleDuplicate }) => (
  <BsTable striped hover size="sm">
    <TableHeader headers={headers} handleAdd={handleAdd} handleDelete={handleDelete} />
    <TableRows rows={rows} handleDelete={handleDelete} handleEdit={handleEdit} handleDuplicate={handleDuplicate} />
  </BsTable>
)

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired,
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  handleEdit: PropTypes.func,
  handleAdd: PropTypes.func,
  handleDelete: PropTypes.func,
  handleDuplicate: PropTypes.func,
}

Table.defaultProps = { handleAdd: null, handleDelete: null, handleEdit: null, handleDuplicate: null }

export default Table
