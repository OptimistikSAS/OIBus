import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbSelect, OIbTitle } from '../components/OIbForm'
import { ConfigContext } from '../context/configContext.jsx'

const SubscribedTo = ({ subscribedTo }) => {
  const { dispatchNewConfig, newConfig } = React.useContext(ConfigContext)
  const dataSourceIds = newConfig && newConfig.south.dataSources.map((dataSource) => dataSource.dataSourceId)
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
    subscribedTo && (
      <>
        <OIbTitle title="Subscribed To">
          <p>allow to select South equipment (default is to receive from all enabled equipment of the current OIBus </p>
        </OIbTitle>
        <Row>
          <Col md={4}>
            <Table
              headers={['Data source']}
              rows={subscribedTo.map((dataSource, i) => [
                {
                  name: `subscribedTo.${i}`,
                  value: (
                    <OIbSelect
                      name={`subscribedTo.${i}`}
                      option={subscribedTo[i]}
                      options={dataSourceIds}
                      onChange={onChange}
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

SubscribedTo.propTypes = { subscribedTo: PropTypes.arrayOf(String).isRequired }

export default SubscribedTo
