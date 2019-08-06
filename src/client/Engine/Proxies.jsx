import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbTitle } from '../components/OIbForm'

const Proxies = ({ proxies }) => proxies && (
  <>
    <OIbTitle title="Proxies">
      <p>
        Some north applications requires to send informations through a proxy. Each proxy needs to be defined in this
        section and can be reused by other OIBus section. This section can be left empty if you dont use proxies on
        your network.
      </p>
    </OIbTitle>
    <Row>
      <Col>
        <Table
          headers={['Name', 'Protocol', 'Host', 'Port', 'User', 'Password']}
          rows={proxies.map((proxie) => Object.entries(proxie).map(([name, value]) => ({ name, value })))}
          onRowClick={() => null}
          actions
        />
      </Col>
    </Row>
  </>
)

Proxies.propTypes = { proxies: PropTypes.arrayOf(Object).isRequired }

export default Proxies

// ['http', 'https'], default: 'http'
