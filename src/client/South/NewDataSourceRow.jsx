import React from 'react'
import PropTypes from 'prop-types'
import { Button, Form, Col, Row } from 'reactstrap'
import { nanoid } from 'nanoid'
import { OIbText, OIbSelect } from '../components/OIbForm/index'

const NewDataSourceRow = ({ protocolList, addDataSource }) => {
  const [name, setName] = React.useState('')
  const [protocol, setProtocol] = React.useState(protocolList[0])
  /**
   * Updates the dataSource's state
   * @param {*} event The change event
   * @returns {void}
   */
  const handleAddDataSource = () => {
    //  update the new dataSource's state
    if (name === '') return
    addDataSource({ id: nanoid(), name, protocol })
  }

  const handleChange = (attributeName, value) => {
    switch (attributeName) {
      case 'name':
        setName(value)
        break
      case 'protocol':
      default:
        setProtocol(value)
        break
    }
  }
  return (
    <Form>
      <Row>
        <Col md="5">
          <OIbText
            label="New DataSource Name"
            value={name}
            name="name"
            onChange={handleChange}
            defaultValue=""
          />
        </Col>
        <Col md="3">
          <OIbSelect
            label="Protocol"
            value={protocol}
            name="protocol"
            options={protocolList}
            defaultValue={protocolList[0]}
            onChange={handleChange}
          />
        </Col>
        <Col md="3">
          <Button size="sm" className="oi-add-button" color="primary" onClick={() => handleAddDataSource()}>
            Add
          </Button>
        </Col>
      </Row>
    </Form>
  )
}

NewDataSourceRow.propTypes = {
  protocolList: PropTypes.arrayOf(PropTypes.string).isRequired,
  addDataSource: PropTypes.func.isRequired,
}
export default NewDataSourceRow
