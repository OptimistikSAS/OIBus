import React from 'react'
import PropTypes from 'prop-types'
import { Container, Button, Form, FormGroup, Label, Input } from 'reactstrap'
import Select from './components/Select.jsx'
import apis from './services/apis'

const NewApplicationRow = ({ apiList, addApplication }) => {
  const [application, setApplication] = React.useState({ applicationId: '', enable: false, api: 'Console' })

  const handleChange = (event) => {
    const { target } = event
    const { value } = target
    //  update the new equipment's state
    setApplication(prevState => ({ ...prevState, [target.name]: value }))
  }

  const handleAddApplication = async () => {
    if (application.applicationId === '') return

    try {
      await apis.addNorth(application)
      addApplication(application)
      // reset the line
      setApplication({ applicationId: '', enable: false, api: 'Console' })
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <Container>
      <Form>
        <FormGroup>
          <Label for="Id">
            Application Id:
            <Input value={application.applicationId} id="Id" name="applicationId" type="text" onChange={handleChange} />
          </Label>
        </FormGroup>
        <FormGroup>
          <Select value={application.api} id="api" name="api" options={apiList} onChange={handleChange} />
        </FormGroup>
        <Button color="primary" onClick={() => handleAddApplication()}>
          Add
        </Button>
      </Form>
    </Container>
  )
}

NewApplicationRow.propTypes = {
  apiList: PropTypes.arrayOf(PropTypes.string).isRequired,
  addApplication: PropTypes.func.isRequired,
}
export default NewApplicationRow
