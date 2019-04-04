import React from 'react'
import { withRouter } from 'react-router-dom'
import Form from 'react-jsonschema-form-bs4'
import PropTypes from 'prop-types'
// import { } from 'reactstrap'

const North = ({ history }) => {
  const [configJson, setConfigJson] = React.useState()
  React.useLayoutEffect(() => {
    // eslint-disable-next-line consistent-return
    fetch('/config').then((response) => {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.indexOf('application/json') !== -1) {
        return response.json().then(({ config }) => {
          setConfigJson(config)
        })
      }
    })
  }, [])
  const log = type => console.info.bind(console, type)

  const handleClick = (element) => {
    const { formData } = element.children.props
    const link = `/north/${formData.api}`
    history.push({ pathname: link, formData })
  }

  const customArrayField = (field) => {
    const { items, onAddClick, title } = field
    return (
      <div>
        <legend>{title}</legend>
        {items.map(element => (
          <div key={element.index} className="array-row">
            <>
              {element.children}
              <button type="button" className="btn btn-primary" onClick={() => handleClick(element)}>
                Configure application
              </button>
            </>
          </div>
        ))}
        {
          <button type="button" onClick={onAddClick}>
            Add application
          </button>
        }
      </div>
    )
  }
  return (
    <>
      <Form
        formData={configJson && configJson.north}
        liveValidate
        ArrayFieldTemplate={customArrayField}
        schema={North.schema}
        uiSchema={North.uiSchema}
        autocomplete="on"
        onChange={log('changed')}
        onSubmit={log('submitted')}
        onError={log('errors')}
      />
      <pre>{configJson && JSON.stringify(configJson.north, ' ', 2)}</pre>
    </>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

North.schema = {
  title: 'North',
  type: 'object',
  properties: {
    applications: {
      type: 'array',
      title: 'Applications',
      items: {
        type: 'object',
        properties: {
          applicationId: {
            type: 'string',
            title: 'Application ID',
          },
          enabled: {
            type: 'boolean',
            title: 'Enabled',
            default: true,
          },
          api: {
            type: 'string',
            title: 'API',
            enum: ['Console', 'InfluxDB', 'RawFileSender', 'TimescaleDB', 'AmazonS3', 'AliveSignal'],
            default: 'Console',
          },
        },
      },
    },
  },
}
export default withRouter(North)
