import React from 'react'
import PropTypes from 'prop-types'
import { Table as BsTable } from 'reactstrap'

import TableHeader from './table-header.jsx'
import TableRows from './table-rows.jsx'
import OibTitle from '../oib-form/oib-title.jsx'

const Table = ({
  help,
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
  handleOrder,
  isHistoryQuery,
}) => (
  <>
    {help && (
      <OibTitle label="Table help">
        <>
          {help.map((e) => e)}
        </>
      </OibTitle>
    )}
    <BsTable striped hover size="sm" className="table">
      <TableHeader
        headers={headers}
        sortableProperties={sortableProperties}
        sortBy={sortBy}
        isAscending={isAscending}
        handleAdd={handleAdd}
        handleDelete={handleDelete}
        handleSort={handleSort}
        handleOrder={handleOrder}
      />
      <TableRows
        rows={rows}
        handleDelete={handleDelete}
        handleEdit={handleEdit}
        handleStatus={handleStatus}
        handleDuplicate={handleDuplicate}
        handleOrder={handleOrder}
        isHistoryQuery={isHistoryQuery}
      />
    </BsTable>
  </>
)

Table.propTypes = {
  help: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
  headers: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired,
  sortableProperties: PropTypes.arrayOf(PropTypes.string),
  sortBy: PropTypes.string,
  isAscending: PropTypes.bool,
  rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
  handleEdit: PropTypes.func,
  handleStatus: PropTypes.func,
  handleAdd: PropTypes.func,
  handleDelete: PropTypes.func,
  handleDuplicate: PropTypes.func,
  handleSort: PropTypes.func,
  handleOrder: PropTypes.func,
  isHistoryQuery: PropTypes.bool,
}

Table.defaultProps = {
  help: null,
  sortableProperties: null,
  sortBy: null,
  isAscending: null,
  handleAdd: null,
  handleDelete: null,
  handleEdit: null,
  handleStatus: null,
  handleDuplicate: null,
  handleSort: null,
  handleOrder: null,
  isHistoryQuery: false,
}

export default Table
