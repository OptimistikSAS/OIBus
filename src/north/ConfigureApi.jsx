import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import { Button } from 'reactstrap'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import apis from '../client/services/apis'
import Modal from '../client/components/Modal.jsx'

const ConfigureApi = ({ match, location }) => {
  const [configJson, setConfigJson] = React.useState()
  const [configSchema, setConfigSchema] = React.useState()

  const updateForm = (formData) => {
    setConfigJson(formData)
  }

  React.useEffect(() => {
    const { api } = match.params
    const { formData } = location

    apis.getNorthApiSchema(api).then((schema) => {
      setConfigSchema(schema)
      updateForm(formData)
    })
  }, [])

  const handleChange = (form) => {
    const { formData } = form

    updateForm(formData)
  }

  const handleSubmit = ({ formData }) => {
    const { applicationId } = formData
    apis.updateNorth(applicationId, formData)
  }

  /**
   * Shows the modal to delete application
   * @returns {void}
   */
  const handleDelete = () => {
    const { applicationId } = configJson
    if (applicationId === '') return
    apis.deleteNorth(applicationId).then(
      () => {
        // TODO: Show loader and redirect to main screen
      },
      (error) => {
        console.error(error)
      },
    )
  }

  const log = type => console.info.bind(console, type)
  return (
    <>
      {configJson && configSchema && (
        <>
          <Form
            formData={configJson}
            liveValidate
            schema={configSchema}
            autocomplete="on"
            onChange={handleChange}
            onSubmit={handleSubmit}
            onError={log('errors')}
          />
          <Modal show={false} title="Delete application" body="Are you sure you want to delete this application?">
            {config => (
              <Button color="danger" onClick={config(handleDelete)}>
                Delete
              </Button>
            )}
          </Modal>
        </>
      )}
      <ReactJson src={configJson} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}

ConfigureApi.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}
export default withRouter(ConfigureApi)
