import React from 'react'
import PropTypes from 'prop-types'
import Table from '../components/table/Table.jsx'

const Proxies = ({ proxies }) => proxies && (
  <Table headers={['Name', 'Protocol', 'Host', 'Port', 'User', 'Password']} rows={proxies} onRowClick={() => null} />
)

Proxies.propTypes = { proxies: PropTypes.arrayOf(Object).isRequired }

export default Proxies

// ['http', 'https'], default: 'http'
