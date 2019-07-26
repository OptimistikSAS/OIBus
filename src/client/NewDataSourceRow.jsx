import React from 'react'
import PropTypes from 'prop-types'
import { Button, Form, FormGroup, Label, Input } from 'reactstrap'
import Select from './components/Select.jsx'
import apis from './services/apis'
import { AlertContext } from './context/AlertContext'

const NewDataSourceRow = ({ protocolList, addDataSource }) => {
  const [dataSource, setDataSource] = React.useState({ dataSourceId: '', enable: false, protocol: 'Modbus' })
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Updates the data source's state
   * @param {*} event The change event
   * @returns {void}
   */
  const handleChange = (event) => {
    const { target } = event
    const { value } = target
    //  update the new data source's state
    setDataSource((prevState) => ({ ...prevState, [target.name]: value }))
  }

  /**
   * Submits a new data source
   * @returns {void}
   */
  const handleAddDataSource = async () => {
    if (dataSource.dataSourceId === '') return

    // Points is required on server side
    dataSource.points = []

    try {
      await apis.addSouth(dataSource)

      // add submitted dataSource to the table
      addDataSource(dataSource)
      // reset the line
      setDataSource({ dataSourceId: '', enable: false, protocol: 'Modbus' })
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  return (
    <Form className="oi-add-new">
      <FormGroup>
        <Label for="Id">
          New Data Source ID
        </Label>
        <Input value={dataSource.dataSourceId} id="Id" name="dataSourceId" type="text" onChange={handleChange} />
      </FormGroup>
      <FormGroup>
        <Label for="protocol">
          Protocol
        </Label>
        <Select value={dataSource.protocol} id="protocol" name="protocol" options={protocolList} onChange={handleChange} />
      </FormGroup>
      <FormGroup>
        <Button color="primary" onClick={() => handleAddDataSource()}>
          Add
        </Button>
      </FormGroup>
    </Form>
  )
}

NewDataSourceRow.propTypes = {
  protocolList: PropTypes.arrayOf(PropTypes.string).isRequired,
  addDataSource: PropTypes.func.isRequired,
}
export default NewDataSourceRow
