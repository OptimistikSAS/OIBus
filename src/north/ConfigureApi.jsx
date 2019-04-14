import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import ConfigService from '../client/services/configService'

const ConfigureApi = ({ match, location }) => {
  const [configJson, setConfigJson] = React.useState()
  const [configSchema, setConfigSchema] = React.useState()

  const updateForm = (formData) => {
    setConfigJson(formData)
  }

  React.useEffect(() => {
    const { api } = match.params
    const { formData } = location

    ConfigService.getNorthApiSchema(api).then((schema) => {
      setConfigSchema(schema)
      updateForm(formData)
    })
  }, [])

  const handleChange = (form) => {
    const { formData } = form

    updateForm(formData)
  }

  const handleSubmit = () => {}

  const log = type => console.info.bind(console, type)
  return (
    <>
      {configJson && configSchema && (
        <Form
          formData={configJson}
          liveValidate
          schema={configSchema}
          autocomplete="on"
          onChange={handleChange}
          onSubmit={handleSubmit}
          onError={log('errors')}
        />
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
