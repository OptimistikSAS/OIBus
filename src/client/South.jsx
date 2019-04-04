import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'

const South = ({ history }) => {
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
    const link = `/south/${formData.protocol}`
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
                Configure equipment
              </button>
            </>
          </div>
        ))}
        {
          <button type="button" onClick={onAddClick}>
            Add protocol
          </button>
        }
      </div>
    )
  }

  return (
    <>
      <Form
        formData={configJson && configJson.south}
        liveValidate
        ArrayFieldTemplate={customArrayField}
        schema={South.schema}
        uiSchema={South.uiSchema}
        autocomplete="on"
        onChange={log('changed')}
        onSubmit={log('submitted')}
        onError={log('errors')}
      />
      <pre>{configJson && JSON.stringify(configJson.south, ' ', 2)}</pre>
    </>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)

South.schema = {
  title: 'South',
  type: 'object',
  properties: {
    Modbus: {
      type: 'object',
      title: 'Modbus',
      properties: {
        addressGap: {
          type: 'object',
          title: 'Address Gap',
          properties: {
            holdingRegister: { type: 'number', title: 'Holding register' },
            coil: { type: 'number', title: 'Coil' },
          },
        },
      },
    },
    equipments: {
      type: 'array',
      title: 'Equipments',
      items: {
        type: 'object',
        properties: {
          equipmentId: {
            type: 'string',
            title: 'Equipment ID',
          },
          enabled: {
            type: 'boolean',
            title: 'Enabled',
            default: true,
          },
          protocol: {
            type: 'string',
            enum: ['CSV', 'MQTT', 'OPCUA', 'RawFile', 'Modbus'],
            title: 'Protocol',
            default: 'CSV',
          },
        },
      },
    },
  },
}
