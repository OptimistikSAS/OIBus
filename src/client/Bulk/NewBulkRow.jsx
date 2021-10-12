import React from 'react'
import { Button, Form, Col, Row } from 'reactstrap'
import PropTypes from 'prop-types'
import { nanoid } from 'nanoid'
import { OIbSelect } from '../components/OIbForm/index'

const NewBulkRow = ({ northHandlers, southHandlers, addBulk }) => {
  const [southHandler, setSouthHandler] = React.useState(southHandlers[0])
  const [northHandler, setNorthHandler] = React.useState(northHandlers[0])

  /**
   * Creates a new bulk with the chosen north and south handler
   * @returns {void}
   */
  const handleAddBulk = () => {
    addBulk({
      id: nanoid(),
      name: `${northHandler.name} -> ${southHandler.name}`,
      enabled: false,
      status: 'pending',
      southId: southHandler.id,
      northId: northHandler.id,
    })
  }

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
    <Form>
      <Row>
        <Col md="4">
          <OIbSelect
            label="South Handler"
            value={southHandler.name}
            name="southHandler"
            options={southHandlers}
            optionsLabel={southHandlers.map((handler) => handler.name)}
            defaultValue={southHandlers[0].name}
            onChange={handleChange}
          />
        </Col>
        <Col md="4">
          <OIbSelect
            label="North Handler"
            value={northHandler.name}
            name="northHandler"
            options={northHandlers}
            optionsLabel={northHandlers.map((handler) => handler.name)}
            defaultValue={northHandlers[0].name}
            onChange={handleChange}
          />
        </Col>
        <Col md="3">
          <Button size="sm" className="oi-add-button" color="primary" onClick={() => handleAddBulk()}>
            Add
          </Button>
        </Col>
      </Row>
    </Form>
  )
}

NewBulkRow.propTypes = {
  northHandlers: PropTypes.arrayOf(Object).isRequired,
  southHandlers: PropTypes.arrayOf(Object).isRequired,
  addBulk: PropTypes.func.isRequired,
}

export default NewBulkRow
