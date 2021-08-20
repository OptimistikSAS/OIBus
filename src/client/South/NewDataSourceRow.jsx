import React from 'react'
import PropTypes from 'prop-types'
import { Button, Form, Col, Row } from 'reactstrap'
import { v4 as uuidv4 } from 'uuid'
import { OIbText, OIbSelect } from '../components/OIbForm/index'

const NewDataSourceRow = ({ protocolList, addDataSource }) => {
  const [dataSourceId, setDataSourceId] = React.useState('')
  const [protocol, setProtocol] = React.useState(protocolList[0])
  /**
   * Updates the dataSource's state
   * @param {*} event The change event
   * @returns {void}
   */
  const handleAddDataSource = () => {
    //  update the new dataSource's state
    if (dataSourceId === '') return
    addDataSource({ id: uuidv4(), dataSourceId, protocol })
  }

  const handleChange = (name, value) => {
    switch (name) {
      case 'dataSourceId':
        setDataSourceId(value)
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
            label="New DataSource ID"
            value={dataSourceId}
            name="dataSourceId"
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
