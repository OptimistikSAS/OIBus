import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { getScheme } from './SchemaHandler'

const ConfigureNorth = ({ match, location }) => {
  const [configJson, setConfigJson] = React.useState()
  const [configSchema, setConfigSchema] = React.useState()

  const updateForm = (formData, api) => {
    setConfigJson(formData)
    setConfigSchema(getScheme(api))
  }

  React.useEffect(() => {
    const { api } = match.params
    const { formData } = location
    updateForm(formData, api)
  }, [])

  const handleChange = (form) => {
    const { formData } = form
    const { api } = formData

    if (configJson.api !== api) {
      // eslint-disable-next-line no-console
      console.log('updating form')
      const newFormData = {}
      newFormData.api = api
      updateForm(newFormData, api)
    }
  }

  const handleSubmit = (form) => {
    // eslint-disable-next-line no-console
    console.log(form)
  }

  const log = type => console.info.bind(console, type)
  return (
    <>
      {configJson && configSchema && (
        <Form
          formData={configJson}
          liveValidate
          schema={configSchema}
          // uiSchema={ConfigureSouth.uiModbus}
          autocomplete="on"
          onChange={handleChange}
          onSubmit={handleSubmit}
          onError={log('errors')}
        />
      )}
      <pre>{configJson && JSON.stringify(configJson, ' ', 2)}</pre>
    </>
  )
}

ConfigureNorth.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}
export default withRouter(ConfigureNorth)
