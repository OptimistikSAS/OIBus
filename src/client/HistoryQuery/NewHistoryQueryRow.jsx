import React from 'react'
import { Button, Form, Col, Row } from 'reactstrap'
import PropTypes from 'prop-types'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'
import { OIbSelect } from '../components/OIbForm/index'
import ProtocolSchemas from '../South/Protocols.jsx'

const NewHistoryQueryRow = ({ northHandlers, southHandlers, addQuery, queriesNumber }) => {
  const [southHandler, setSouthHandler] = React.useState(southHandlers[0])
  const [northHandler, setNorthHandler] = React.useState(northHandlers[0])
  const { protocol } = southHandler
  const navigate = useNavigate()
  const schema = protocol === 'SQLDbToFile'
    ? ProtocolSchemas.SQLDbToFile.withDriver(southHandler.SQLDbToFile.driver)
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
      ...(schema.points ? { points: southHandler.points || [] } : { query: southHandler[protocol].query || '' }),
      order: queriesNumber + 1,
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
        setSouthHandler(value)
        break
      case 'northHandler':
      default:
        setNorthHandler(value)
        break
    }
  }

  return (
    <Form className="mt-5">
      <Row>
        <Col md="4">
          <OIbSelect
            label="South Handler"
            value={southHandler}
            name="southHandler"
            options={southHandlers.map((handler) => handler.id)}
            optionsLabel={southHandlers.map((handler) => handler.name)}
            defaultValue={southHandlers[0].id}
            onChange={handleChange}
          />
        </Col>
        <Col md="4">
          <OIbSelect
            label="North Handler"
            value={northHandler}
            name="northHandler"
            options={northHandlers.map((handler) => handler.id)}
            optionsLabel={northHandlers.map((handler) => handler.name)}
            defaultValue={northHandlers[0].name}
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
  queriesNumber: PropTypes.number.isRequired,
}

export default NewHistoryQueryRow
