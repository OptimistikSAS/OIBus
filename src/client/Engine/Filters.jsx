import React from 'react'
import PropTypes from 'prop-types'
import Table from '../components/table/Table.jsx'

const Filters = ({ filters }) => filters && (
  <Table
    headers={['adresse']}
    rows={filters.map((filter) => [{ name: 'filter', value: filter }])}
    onRowClick={() => null}
  />
)

Filters.propTypes = { filters: PropTypes.arrayOf(String).isRequired }

export default Filters

/*
    label="Network Filter"
     defaultIpAddresses={['127.0.0.1']}
            help={(
              <div>
                The list of IP addresses or hostnames allowed to access the Admin interface (can use * as a wildcard)
              </div>
*/
