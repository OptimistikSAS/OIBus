import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/Table.jsx'


const Filters = ({ filters }) => filters && (
  <>
    <h2>IP Filters</h2>
    <Row>
      <Col md={6}>
        <Table
          headers={['adresse']}
          rows={filters.map((filter) => [{ name: 'filter', value: filter }])}
          onRowClick={() => null}
        />
      </Col>
    </Row>
  </>
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
