import React from 'react'
import { Button, Form, Col, Row } from 'reactstrap'
import PropTypes from 'prop-types'
import { OIbSelect } from '../components/OIbForm/index'
import SouthSchemas from '../South/SouthTypes.jsx'

const HISTORY_QUERY_CAPABLE_SOUTH_CONNECTORS = [
  'OPCUA_HA', 'OPCHDA', 'SQL',
]

const NewHistoryQueryRow = ({ northHandlers, southHandlers, addQuery }) => {
  const filteredSouthHandlers = southHandlers.filter((southConnector) => HISTORY_QUERY_CAPABLE_SOUTH_CONNECTORS.includes(southConnector.type))
  const [south, setSouth] = React.useState(filteredSouthHandlers[0])
  const [north, setNorth] = React.useState(northHandlers[0])
  const southSchema = south.type === 'SQL'
    ? SouthSchemas.SQL.withDriver(south.SQL.driver)
    : SouthSchemas[south.type]

  /**
   * Creates a new history query with the chosen north and south handler
   * @returns {void}
   */
  const handleAddHistoryQuery = () => {
    const currentDateMinus7Days = new Date()
    currentDateMinus7Days.setDate(currentDateMinus7Days.getDate() - 7)

    addQuery({
      name: `${south.name} -> ${north.name}`,
      enabled: false,
      status: 'pending',
      startTime: currentDateMinus7Days,
      endTime: new Date(),
      southId: south.id,
      northId: north.id,
      settings: {
        ...(southSchema.points ? { points: south.points || [] } : { query: south[south.type].query || '' }),
        maxReadInterval: south[south.type].maxReadInterval,
        readIntervalDelay: south[south.type].readIntervalDelay,
      },
      filePattern: './@ConnectorName-@CurrentDate-@QueryPart.csv',
      compress: false,
    })
  }

  /**
   * Sets the new value for the south or north handler
   * @param {string} attributeName The name of the attribute that will be changed
   * @param {string} value The value of the attribute name
   * @returns {void}
   */
  const handleChange = (attributeName, value) => {
    switch (attributeName) {
      case 'southHandler':
        setSouth(filteredSouthHandlers.find((handler) => handler.id === value))
        break
      case 'northHandler':
      default:
        setNorth(northHandlers.find((handler) => handler.id === value))
        break
    }
  }

  return (
    <Form className="mt-5">
      <Row>
        <Col md="4">
          <OIbSelect
            label="South Handler"
            value={south.id}
            name="southHandler"
            options={filteredSouthHandlers.map((handler) => handler.id)}
            optionsLabel={filteredSouthHandlers.map((handler) => handler.name)}
            defaultValue={filteredSouthHandlers[0].id}
            onChange={handleChange}
          />
        </Col>
        <Col md="4">
          <OIbSelect
            label="North Handler"
            value={north.id}
            name="northHandler"
            options={northHandlers.map((handler) => handler.id)}
            optionsLabel={northHandlers.map((handler) => handler.name)}
            defaultValue={northHandlers[0].id}
            onChange={handleChange}
          />
        </Col>
        <Col md="2">
          <Button className="oi-add-history-query" color="primary" onClick={() => handleAddHistoryQuery()}>
            Add
          </Button>
        </Col>
      </Row>
    </Form>
  )
}

NewHistoryQueryRow.propTypes = {
  northHandlers: PropTypes.arrayOf(PropTypes.object).isRequired,
  southHandlers: PropTypes.arrayOf(PropTypes.object).isRequired,
  addQuery: PropTypes.func.isRequired,
}

export default NewHistoryQueryRow
