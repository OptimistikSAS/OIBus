import React from 'react'
import PropTypes from 'prop-types'
import Table from '../components/table/Table.jsx'

const IpFilters = ({ adresses }) => adresses && <Table headers={['adresse']} rows={adresses} onRowClick={() => null} />

IpFilters.propTypes = { adresses: PropTypes.arrayOf(String).isRequired }

export default IpFilters

/*
    label="Network Filter"
     defaultIpAddresses={['127.0.0.1']}
            help={(
              <div>
                The list of IP addresses or hostnames allowed to access the Admin interface (can use * as a wildcard)
              </div>
*/
