import React from 'react'
import PropTypes from 'prop-types'
import { Button, Form, Col, Row } from 'reactstrap'
import { nanoid } from 'nanoid'
import { OIbText, OIbSelect } from '../components/OIbForm/index'

const NewApplicationRow = ({ apiList, addApplication }) => {
  const [name, setName] = React.useState('')
  const [api, setApi] = React.useState(apiList[0])
  /**
   * Updates the application's state
   * @param {*} event The change event
   * @returns {void}
   */
  const handleAddApplication = () => {
    //  update the new application's state
    if (name === '') return
    addApplication({ id: nanoid(), name, api })
  }

  const handleChange = (attributeName, value) => {
    switch (attributeName) {
      case 'name':
        setName(value)
        break
      case 'api':
      default:
        setApi(value)
        break
    }
  }
  return (
    <Form>
      <Row>
        <Col md="5">
          <OIbText
            label="New Application Name"
            value={name}
            name="name"
            onChange={handleChange}
            defaultValue=""
          />
        </Col>
        <Col md="3">
          <OIbSelect label="API" value={api} name="api" options={apiList} defaultValue={apiList[0]} onChange={handleChange} />
        </Col>
        <Col md="3">
          <Button size="sm" className="oi-add-button" color="primary" onClick={() => handleAddApplication()}>
            Add
          </Button>
        </Col>
      </Row>
    </Form>
  )
}

NewApplicationRow.propTypes = {
  apiList: PropTypes.arrayOf(PropTypes.string).isRequired,
  addApplication: PropTypes.func.isRequired,
}
export default NewApplicationRow
