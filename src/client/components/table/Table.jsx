import React from 'react'
import PropTypes from 'prop-types'
import TableHeader from './TableHeader.jsx'
import TableRows from './TableRows.jsx'

const Table = ({ headers, rows, onRowClick }) => (
  <table className="table table-striped table-hover table-sm">
    <TableHeader headers={headers} />
    <TableRows rows={rows} onRowClick={onRowClick} />
  </table>
)

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.string).isRequired,
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func.isRequired,
}

export default Table
