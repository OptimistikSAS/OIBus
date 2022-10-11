import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../../components/table/Table.jsx'
import { OIbSelect, OIbTitle } from '../../components/OIbForm'
import { ConfigContext } from '../../context/ConfigContext.jsx'

const SubscribedTo = ({ subscribedTo, northIndex }) => {
  const { dispatchNewConfig, newConfig } = React.useContext(ConfigContext)
  const southIds = newConfig?.south?.map((south) => south.id) ?? []
  const southNames = newConfig?.south?.map((south) => south.name) ?? []
  const externalSources = newConfig?.engine?.externalSources ?? []
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `north.${northIndex}.subscribedTo.${rowIndex}` })
  }
  const handleAdd = () => {
    const defaultValue = southIds[0]
    dispatchNewConfig({ type: 'addRow', name: `north.${northIndex}.subscribedTo`, value: defaultValue })
  }
  const onChange = (name, value) => {
    dispatchNewConfig({ type: 'update', name: `north.${northIndex}.${name}`, value })
  }
  return (
    subscribedTo && (
      <>
        <OIbTitle label="Subscribed To">
          <p>
            Allow to select what South equipment are connected to this North connector.
            The default is to receive from all enabled south equipments of the current OIBus.
          </p>
        </OIbTitle>
        <Row>
          <Col md={4}>
            <Table
              headers={['Data source']}
              rows={subscribedTo.map((_, i) => [
                {
                  name: `subscribedTo.${i}`,
                  value: (
                    <OIbSelect
                      name={`subscribedTo.${i}`}
                      value={subscribedTo[i]}
                      options={[...southIds, ...externalSources]}
                      optionsLabel={southNames}
                      defaultValue={southIds[0] || ''}
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
  northIndex: PropTypes.number.isRequired,
}

export default SubscribedTo
