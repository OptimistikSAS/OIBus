import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../../components/table/Table.jsx'
import { OIbSelect, OIbTitle } from '../../components/OIbForm'
import { ConfigContext } from '../../context/ConfigContext.jsx'

const SubscribedTo = ({ subscribedTo, applicationIndex }) => {
  const { dispatchNewConfig, newConfig } = React.useContext(ConfigContext)
  const dataSourceIds = newConfig?.south?.map((dataSource) => dataSource.id) ?? []
  const dataSourceNames = newConfig?.south?.map((dataSource) => dataSource.name) ?? []
  const externalSources = newConfig?.engine?.externalSources ?? []
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `north.${applicationIndex}.subscribedTo.${rowIndex}` })
  }
  const handleAdd = () => {
    const defaultValue = dataSourceIds[0]
    dispatchNewConfig({ type: 'addRow', name: `north.${applicationIndex}.subscribedTo`, value: defaultValue })
  }
  const onChange = (name, value) => {
    dispatchNewConfig({ type: 'update', name: `north.${applicationIndex}.${name}`, value })
  }
  return (
    subscribedTo && (
      <>
        <OIbTitle label="Subscribed To">
          <p>
            Allow to select what South equipment are connected to this North application.
            The default is to receive from all enabled south equipments of the current OIBus.
          </p>
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
                      value={subscribedTo[i]}
                      options={[...dataSourceIds, ...externalSources]}
                      optionsLabel={dataSourceNames}
                      defaultValue={dataSourceIds[0] || ''}
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

SubscribedTo.propTypes = {
  subscribedTo: PropTypes.arrayOf(String).isRequired,
  applicationIndex: PropTypes.number.isRequired,
}

export default SubscribedTo
