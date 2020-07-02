import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbText, OIbTitle } from '../components/OIbForm'
import { ConfigContext } from '../context/configContext.jsx'
import validation from './Engine.validation'

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
        <OIbTitle label="ExternalSources">
          <p>
            This is a list of dataSources from another OIBus. The name should respect the following convention:
            OIbusId:datasourceId
          </p>
        </OIbTitle>
        <Row>
          <Col md={4}>
            <Table
              headers={['Id']}
              rows={externalSources.map((filter, i) => [
                {
                  name: `engine.externalSources.${i}`,
                  value: (
                    <OIbText
                      name={`engine.externalSources.${i}`}
                      value={filter}
                      valid={validation.engine.externalSources}
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
