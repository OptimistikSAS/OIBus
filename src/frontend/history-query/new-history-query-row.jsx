import React from 'react'
import { Button, Col, Form, Row } from 'reactstrap'
import PropTypes from 'prop-types'
import { OibSelect } from '../components/oib-form/index.js'
import SouthSchemas from '../south/south-types.jsx'

const NewHistoryQueryRow = ({ northHandlers, southHandlers, addQuery }) => {
  const [south, setSouth] = React.useState(southHandlers[0])
  const [north, setNorth] = React.useState(northHandlers[0])
  const southSchema = south?.type === 'SQL'
    ? SouthSchemas.SQL.withDriver(south.settings.driver)
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
        ...(southSchema.points ? { points: south.points || [] } : { query: south.settings.query || '' }),
        maxReadInterval: south.settings.maxReadInterval,
        readIntervalDelay: south.settings.readIntervalDelay,
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
        setSouth(southHandlers.find((handler) => handler.id === value))
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
          <OibSelect
            label="South Handler"
            value={south.id}
            name="southHandler"
            options={southHandlers.map((handler) => handler.id)}
            optionsLabel={southHandlers.map((handler) => handler.name)}
            defaultValue={southHandlers[0].id}
            onChange={handleChange}
          />
        </Col>
        <Col md="4">
          <OibSelect
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
