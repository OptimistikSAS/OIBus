import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/table.jsx'
import { OibText, OibTitle } from '../components/oib-form'
import { ConfigContext } from '../context/config-context.jsx'
import validation from './engine.validation'

const Filters = ({ filters }) => {
  const { dispatchNewConfig } = React.useContext(ConfigContext)
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `engine.filter.${rowIndex}` })
  }
  const handleAdd = () => {
    dispatchNewConfig({ type: 'addRow', name: 'engine.filter', value: '' })
  }
  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }
  return (
    filters && (
      <>
        <OibTitle label="IP Filters">
          <p>
            This is the list of IP adresses (or hostnames) that will be allowed to access the admin console.
            By default, it is only the local host. It is possible to use wildcards (such as 192.168.1.* or just
            * to allow every IP address) in the IP address to authorize a subnet for example.
          </p>
        </OibTitle>
        <Row>
          <Col md={4}>
            <Table
              headers={['Addresses']}
              rows={filters.map((filter, i) => [
                {
                  name: `engine.filter.${i}`,
                  value: (
                    <OibText
                      name={`engine.filter.${i}`}
                      value={filter}
                      valid={validation.engine.filter}
                      onChange={onChange}
                      defaultValue=""
                    />
                  ),
                },
              ])}
              handleDelete={handleDelete}
              handleAdd={handleAdd}
            />
          </Col>
        </Row>
      </>
    )
  )
}

Filters.propTypes = { filters: PropTypes.arrayOf(String).isRequired }

export default Filters
