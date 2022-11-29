import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/table.jsx'
import { OibText, OibTitle } from '../components/oib-form/index.js'
import { ConfigContext } from '../context/config-context.jsx'
import validation from './engine.validation.js'

const ExternalSources = ({ externalSources }) => {
  const { dispatchNewConfig } = React.useContext(ConfigContext)
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `engine.externalSources.${rowIndex}` })
  }
  const handleAdd = () => {
    dispatchNewConfig({ type: 'addRow', name: 'engine.externalSources', value: '' })
  }
  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }
  return (
    externalSources && (
      <>
        <OibTitle label="ExternalSources">
          <p>
            This is a list of south connectors from another OIBus. The name should respect the following convention:
            OIBusId:SouthName
          </p>
        </OibTitle>
        <Row>
          <Col md={4}>
            <Table
              headers={['Id']}
              rows={externalSources.map((filter, i) => [
                {
                  name: `engine.externalSources.${i}`,
                  value: (
                    <OibText
                      name={`engine.externalSources.${i}`}
                      value={filter}
                      valid={validation.engine.externalSources.id}
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

ExternalSources.propTypes = { externalSources: PropTypes.arrayOf(String) }
ExternalSources.defaultProps = { externalSources: [] }
export default ExternalSources
