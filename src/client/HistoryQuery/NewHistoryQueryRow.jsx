import React from 'react'
import { Button, Form, Col, Row } from 'reactstrap'
import PropTypes from 'prop-types'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'
import { OIbSelect } from '../components/OIbForm/index'
import ProtocolSchemas from '../South/Protocols.jsx'

const HISTORY_QUERY_CAPABLE_PROTOCOLS = [
  'OPCUA_HA', 'OPCHDA', 'SQL',
]

const NewHistoryQueryRow = ({ northHandlers, southHandlers, addQuery }) => {
  const filteredSouthHandlers = southHandlers.filter((handler) => HISTORY_QUERY_CAPABLE_PROTOCOLS.includes(handler.protocol))
  const [southHandler, setSouthHandler] = React.useState(filteredSouthHandlers[0])
  const [northHandler, setNorthHandler] = React.useState(northHandlers[0])
  const { protocol } = southHandler
  const navigate = useNavigate()
  const schema = protocol === 'SQL'
    ? ProtocolSchemas.SQL.withDriver(southHandler.SQL.driver)
    : ProtocolSchemas[protocol]

  /**
   * Creates a new history query with the chosen north and south handler
   * @returns {void}
   */
  const handleAddHistoryQuery = () => {
    const id = nanoid()
    const currentDateMinus7Days = new Date()
    currentDateMinus7Days.setDate(currentDateMinus7Days.getDate() - 7)

    addQuery({
      id,
      name: `${southHandler.name} -> ${northHandler.name}`,
      enabled: false,
      status: 'pending',
      startTime: currentDateMinus7Days,
      endTime: new Date(),
      southId: southHandler.id,
      northId: northHandler.id,
      settings: { ...(schema.points ? { points: southHandler.points || [] } : { query: southHandler[protocol].query || '' }) },
      filePattern: './@ConnectorName-@CurrentDate-@QueryPart.csv',
      compress: false,
      paused: false,
    })
    navigate(`/history-query/${id}`)
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
        setSouthHandler(filteredSouthHandlers.find((handler) => handler.id === value))
        break
      case 'northHandler':
      default:
        setNorthHandler(northHandlers.find((handler) => handler.id === value))
        break
    }
  }

  return (
    <Form className="mt-5">
      <Row>
        <Col md="4">
          <OIbSelect
            label="South Handler"
            value={southHandler.id}
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
            value={northHandler.id}
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
