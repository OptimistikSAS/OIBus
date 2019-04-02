import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import { getScheme } from './Schemas'

// eslint-disable-next-line react/prop-types
const ConfigureSouth = ({ match, location }) => {
  const [configJson, setConfigJson] = React.useState()
  const [configSchema, setConfigSchema] = React.useState()

  const updateForm = () => {
    const { protocol } = match.params
    const { formData } = location
    setConfigJson(formData)
    setConfigSchema(getScheme(protocol))
  }
  React.useEffect(() => {
    updateForm()
  }, [])

  const handleChange = (data) => {
    const { formData } = data
    const { protocol } = formData

    if (configJson !== data.formData) {
      setConfigJson(formData)
      setConfigSchema(getScheme(protocol))
    }
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
          onSubmit={log('submitted')}
          onError={log('errors')}
        />
      )}
      <pre>{configJson && JSON.stringify(configJson, ' ', 2)}</pre>
    </>
  )
}

export default withRouter(ConfigureSouth)

ConfigureSouth.schema = {
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
          // pointIdRoot: {
          //   type: 'string',
          //   title: 'Point ID Root',
          // },
          // defaultScanMode: {
          //   type: 'string',
          //   title: 'Default Scan Mode',
          //   default: 'every20Second',
          // },
          // '^[A-Z]+$': {
          //   type: 'object',
          //   properties: {
          //     inputFolder: {
          //       type: 'string',
          //       title: 'Input Folder',
          //     },
          //     archiveFolder: {
          //       type: 'string',
          //       title: 'Archive Folder',
          //     },
          //     errorFolder: {
          //       type: 'string',
          //       title: 'Error Folder',
          //     },
          //     separator: {
          //       type: 'string',
          //       title: 'Separator',
          //       default: ',',
          //     },
          //     timeColumn: {
          //       type: 'number',
          //       title: 'Time Column',
          //       default: 0,
          //     },
          //     hasFirstLine: {
          //       type: 'boolean',
          //       title: 'Has First Line',
          //       default: true,
          //     },
          //   },
          // },
          // points: {
          //   type: 'array',
          //   title: 'Points',
          //   items: {},
          // },
        },
      },
    },
  },
}
