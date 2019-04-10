/* eslint-disable import/no-unresolved */
import React from 'react'
import PropTypes from 'prop-types'
import TableHeader from './TableHeader.jsx'
import TableRows from './TableRows.jsx'
import './table.css'

const Table = ({ headers, rows, onRowClick }) => (
  <table className="table">
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
