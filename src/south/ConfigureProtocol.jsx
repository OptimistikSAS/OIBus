import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import { Button, Col } from 'reactstrap'
import PropTypes from 'prop-types'
import Modal from '../client/components/Modal.jsx'
import apis from '../client/services/apis'
import uiSchema from './uiSchema.jsx'
import { AlertContext } from '../client/context/AlertContext'

const ConfigureProtocol = ({ match, location }) => {
  const [configJson, setConfigJson] = React.useState()
  const [configSchema, setConfigSchema] = React.useState()
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Sets the configuration JSON
   * @param {Object} formData Data of the form
   * @returns {void}
   */
  const updateForm = (formData) => {
    setConfigJson(formData)
  }

  /**
   * Acquire the schema and set the configuration JSON
   * @returns {void}
   */
  React.useEffect(() => {
    const { protocol } = match.params
    const { formData } = location

    apis.getSouthProtocolSchema(protocol).then((schema) => {
      delete schema.properties.points
      setConfigSchema(schema)
      updateForm(formData)
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }, [])

  /**
   * Handles the form's submittion
   * @param {*} param0 Object containing formData field
   * @returns {void}
   */
  const handleSubmit = ({ formData }) => {
    const { dataSourceId } = formData
    apis.updateSouth(dataSourceId, formData).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }

  /**
   * Handles the form's change
   * @param {Object} form The data of the form
   * @returns {void}
   */
  const handleChange = (form) => {
    const { formData } = form

    updateForm(formData)
    handleSubmit(form)
  }

  /**
   * Shows the modal to delete application
   * @returns {void}
   */
  const handleDelete = async () => {
    const { dataSourceId } = configJson
    try {
      await apis.deleteSouth(dataSourceId)
      // TODO: Show loader and redirect to main screen
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  const log = (type) => console.info.bind(console, type)
  return (
    <Col xs="12" md="6">
      {configJson && configSchema && (
        <>
          <Form
            formData={configJson}
            liveValidate
            showErrorList={false}
            schema={configSchema}
            uiSchema={uiSchema(configJson.protocol)}
            autocomplete="on"
            onChange={handleChange}
            onError={log('errors')}
          >
            <></>
          </Form>
          <Modal show={false} title="Delete data source" body="Are you sure you want to delete this data source?">
            {(confirm) => (
              <Button color="danger" onClick={confirm(handleDelete)}>
                Delete
              </Button>
            )}
          </Modal>
        </>
      )}
    </Col>
  )
}

ConfigureProtocol.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}

export default withRouter(ConfigureProtocol)
