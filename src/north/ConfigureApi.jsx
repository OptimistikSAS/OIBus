import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import { Button, Col } from 'reactstrap'
import PropTypes from 'prop-types'
import apis from '../client/services/apis'
import Modal from '../client/components/Modal.jsx'
import uiSchema from './uiSchema.jsx'
import { AlertContext } from '../client/context/AlertContext'

const ConfigureApi = ({ match, location }) => {
  const [configJson, setConfigJson] = React.useState()
  const [configSchema, setConfigSchema] = React.useState()
  const [dataSourceIds, setDataSourceIds] = React.useState([])
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
    const { api } = match.params
    const { formData, subscribeList } = location

    setDataSourceIds(subscribeList)

    apis.getNorthApiSchema(api).then((schema) => {
      setConfigSchema(schema)
      updateForm(formData)
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }, [])

  /**
   * Make modification based on south dataSources to the config schema
   * @returns {object} config schema
   */
  const modifiedConfigSchema = () => {
    // check if configSchema is are already set
    if (configSchema) {
      const { subscribedTo } = configSchema.properties
      // check if subscribedTo exists and enum was not already set
      if (subscribedTo && subscribedTo.enum === undefined) {
        subscribedTo.items.enum = dataSourceIds
      }
    }
    return configSchema
  }

  /**
   * Handles the form's submittion
   * @param {*} param0 Object containing formData field
   * @returns {void}
   */
  const handleSubmit = ({ formData }) => {
    const { applicationId } = formData
    apis.updateNorth(applicationId, formData).catch((error) => {
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
    // submit change immediately on change
    handleSubmit(form)
  }

  /**
   * Shows the modal to delete application
   * @returns {void}
   */
  const handleDelete = async () => {
    const { applicationId } = configJson
    if (applicationId === '') return
    try {
      await apis.deleteNorth(applicationId)
      // TODO: Show loader and redirect to main screen
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  const log = (type) => console.info.bind(console, type)

  return (
    <>
      {configJson && configSchema && (
        <Col xs="12" md="6">
          <Form
            formData={configJson}
            liveValidate
            showErrorList={false}
            schema={modifiedConfigSchema()}
            uiSchema={uiSchema(configJson.api)}
            autocomplete="on"
            onChange={handleChange}
            onError={log('errors')}
          >
            <></>
          </Form>
          <Modal show={false} title="Delete application" body="Are you sure you want to delete this application?">
            {(config) => (
              <Button color="danger" onClick={config(handleDelete)}>
                Delete
              </Button>
            )}
          </Modal>
        </Col>
      )}
    </>
  )
}

ConfigureApi.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}
export default withRouter(ConfigureApi)
