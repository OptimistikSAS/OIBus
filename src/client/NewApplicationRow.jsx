import React from 'react'
import PropTypes from 'prop-types'
import { Button, Form, FormGroup, Label, Input } from 'reactstrap'
import Select from './components/Select.jsx'
import apis from './services/apis'
import { AlertContext } from './context/AlertContext'

const NewApplicationRow = ({ apiList, addApplication }) => {
  const [application, setApplication] = React.useState({ applicationId: '', enable: false, api: 'Console' })
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Updates the application's state
   * @param {*} event The change event
   * @returns {void}
   */
  const handleChange = (event) => {
    const { target } = event
    const { value } = target
    //  update the new application's state
    setApplication((prevState) => ({ ...prevState, [target.name]: value }))
  }

  /**
   * Submits a new application
   * @returns {void}
   */
  const handleAddApplication = async () => {
    if (application.applicationId === '') return

    try {
      await apis.addNorth(application)
      // add submitted application to the table
      addApplication(application)
      // reset the line
      setApplication({ applicationId: '', enable: false, api: 'Console' })
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  return (
    <Form className="oi-add-new">
      <FormGroup>
        <Label for="Id">
          New Application ID
        </Label>
        <Input value={application.applicationId} id="Id" name="applicationId" type="text" onChange={handleChange} />
      </FormGroup>
      <FormGroup>
        <Label for="api">
          API
        </Label>
        <Select value={application.api} id="api" name="api" options={apiList} onChange={handleChange} />
      </FormGroup>
      <FormGroup>
        <Button color="primary" onClick={() => handleAddApplication()}>
          Add
        </Button>
      </FormGroup>
    </Form>
  )
}

NewApplicationRow.propTypes = {
  apiList: PropTypes.arrayOf(PropTypes.string).isRequired,
  addApplication: PropTypes.func.isRequired,
}
export default NewApplicationRow
