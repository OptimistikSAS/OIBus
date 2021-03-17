import React from 'react'
import PropTypes from 'prop-types'
import { Table as BsTable } from 'reactstrap'

import TableHeader from './TableHeader.jsx'
import TableRows from './TableRows.jsx'

const Table = ({
  headers,
  sortableProperties,
  sortBy,
  isAscending,
  rows,
  handleAdd,
  handleDelete,
  handleEdit,
  handleStatus,
  handleDuplicate,
  handleSort,
}) => (
  <BsTable striped hover size="sm">
    <TableHeader
      headers={headers}
      sortableProperties={sortableProperties}
      sortBy={sortBy}
      isAscending={isAscending}
      handleAdd={handleAdd}
      handleDelete={handleDelete}
      handleSort={handleSort}
    />
    <TableRows rows={rows} handleDelete={handleDelete} handleEdit={handleEdit} handleStatus={handleStatus} handleDuplicate={handleDuplicate} />
  </BsTable>
)

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired,
  sortableProperties: PropTypes.arrayOf(PropTypes.string),
  sortBy: PropTypes.string,
  isAscending: PropTypes.bool,
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  handleEdit: PropTypes.func,
  handleStatus: PropTypes.func,
  handleAdd: PropTypes.func,
  handleDelete: PropTypes.func,
  handleDuplicate: PropTypes.func,
  handleSort: PropTypes.func,
}

Table.defaultProps = {
  sortableProperties: null,
  sortBy: null,
  isAscending: null,
  handleAdd: null,
  handleDelete: null,
  handleEdit: null,
  handleStatus: null,
  handleDuplicate: null,
  handleSort: null,
}

export default Table
