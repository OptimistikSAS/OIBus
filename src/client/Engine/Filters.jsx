import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbText } from '../components/OIbForm'
import { EngineContext } from '../context/configContext.jsx'

const Filters = ({ filters }) => {
  const { configDispatch } = React.useContext(EngineContext)
  const onChange = (name, value, validity) => {
    console.info('dispatch:', name, value, validity)
    configDispatch({ type: 'updateFilters', name, value, validity })
  }
  return (
    filters && (
      <>
        <h2>IP Filters</h2>
        <Row>
          <Col md={6}>
            <Table
              headers={['#', 'adresse']}
              rows={filters.map((filter, i) => [
                {
                  name: `key[${i}]`,
                  value: i,
                },
                {
                  name: `filter[${i}]`,
                  value: (
                    <OIbText
                      name={`filter[${i}]`}
                      value={filter}
                      regExp={/^.{2,}$/} // i.e. min size = 2
                      onChange={onChange}
                    />
                  ),
                },
              ])}
              onRowClick={() => null}
            />
          </Col>
        </Row>
      </>
    )
  )
}

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
