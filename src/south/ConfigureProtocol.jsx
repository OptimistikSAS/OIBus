import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import { Button } from 'reactstrap'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import Modal from '../client/components/Modal.jsx'
import apis from '../client/services/apis'

const ConfigureProtocol = ({ match, location }) => {
  const [configJson, setConfigJson] = React.useState()
  const [configSchema, setConfigSchema] = React.useState()

  const updateForm = (formData) => {
    setConfigJson(formData)
  }

  React.useEffect(() => {
    const { protocol } = match.params
    const { formData } = location

    apis.getSouthProtocolSchema(protocol).then((schema) => {
      setConfigSchema(schema)
      updateForm(formData)
    })
  }, [])

  const handleChange = (data) => {
    const { formData } = data

    updateForm(formData)
  }

  const handleSubmit = ({ formData }) => {
    const { equipmentId } = formData
    apis.updateSouth(equipmentId, formData)
  }

  /**
   * Shows the modal to delete application
   * @returns {void}
   */
  const handleDelete = () => {
    const { equipmentId } = configJson
    apis.deleteSouth(equipmentId).then(
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
            // uiSchema={configureProtocol.uiModbus}
            autocomplete="on"
            onChange={handleChange}
            onSubmit={handleSubmit}
            onError={log('errors')}
          />
          <Modal show={false} title="Delete equipment" body="Are you sure you want to delete this equipment?">
            {confirm => (
              <Button color="danger" onClick={confirm(handleDelete)}>
                Delete
              </Button>
            )}
          </Modal>
          <ReactJson src={configJson} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
        </>
      )}
    </>
  )
}

ConfigureProtocol.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}

export default withRouter(ConfigureProtocol)
