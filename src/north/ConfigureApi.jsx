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
  const [showModal, setShowModal] = React.useState(false)

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
    setShowModal(true)
  }

  /**
   * Deletes the application and redirects to north page
   * @returns {void}
   */
  const onAcceptDelete = () => {
    const { applicationId } = configJson
    setShowModal(false)
    apis.deleteNorth(applicationId).then(
      () => {
        // TODO: Show loader and redirect to main screen
      },
      (error) => {
        console.error(error)
      },
    )
  }

  /**
   * Hides the modal if it was dismissed
   * @returns {void}
   */
  const onDenyDelete = () => {
    setShowModal(false)
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
          <Button color="danger" onClick={handleDelete}>
            Delete
          </Button>
        </>
      )}
      <ReactJson src={configJson} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
      <Modal
        show={showModal}
        title="Delete application"
        body="Are you sure you want to delete this application?"
        onAccept={onAcceptDelete}
        onDeny={onDenyDelete}
      />
    </>
  )
}

ConfigureApi.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}
export default withRouter(ConfigureApi)
