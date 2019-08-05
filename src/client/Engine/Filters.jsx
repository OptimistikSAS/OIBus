import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col, Button } from 'reactstrap'
import { FaTrashAlt, FaPlusCircle } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import { OIbText, OIbTitle } from '../components/OIbForm'
import { EngineContext } from '../context/configContext.jsx'

const Filters = ({ filters }) => {
  const { configDispatch } = React.useContext(EngineContext)
  const onChange = (name, value, validity) => {
    configDispatch({ type: 'updateEngine', name, value, validity })
  }
  return (
    filters && (
      <>
        <OIbTitle title="IP Filters">
          <p>
            This is the list of IP adresses (or hostnames) that will be allowed to access the admin console. By default,
            it is only the local host. It is possible to use wildcards (such as 192.168.1.*) in the IP adress to
            authorize a subnet for example.
          </p>
        </OIbTitle>
        <Row>
          <Col md={6}>
            <Table
              headers={[
                <>
                  <FaPlusCircle className="oi-icon" />
                  <span>adresse</span>
                </>, '']}
              rows={filters.map((filter, i) => [
                {
                  name: `filter.${i}`,
                  value: (
                    <OIbText
                      name={`filter.${i}`}
                      value={filter}
                      regExp={/^.{2,}$/} // i.e. min size = 2
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: 'actions',
                  value: <Button close><FaTrashAlt className="oi-icon" /></Button>,
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
