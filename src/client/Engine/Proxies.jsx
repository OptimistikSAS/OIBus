import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import Table from '../components/table/Table.jsx'

const Proxies = ({ proxies }) => proxies && (
  <>
    <h2>Proxies</h2>
    <Row>
      <Col>
        <Table
          headers={['Name', 'Protocol', 'Host', 'Port', 'User', 'Password']}
          rows={proxies.map((proxie) => Object.entries(proxie).map(([name, value]) => ({ name, value })))}
          onRowClick={() => null}
        />
      </Col>
    </Row>
  </>
)

Proxies.propTypes = { proxies: PropTypes.arrayOf(Object).isRequired }

export default Proxies

// ['http', 'https'], default: 'http'
