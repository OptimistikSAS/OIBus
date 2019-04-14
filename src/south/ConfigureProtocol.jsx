import React from 'react'
import Form from 'react-jsonschema-form-bs4'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import ConfigService from '../client/services/configService'

const ConfigureProtocol = ({ match, location }) => {
  const [configJson, setConfigJson] = React.useState()
  const [configSchema, setConfigSchema] = React.useState()

  const updateForm = (formData) => {
    setConfigJson(formData)
  }

  React.useEffect(() => {
    const { protocol } = match.params
    const { formData } = location

    ConfigService.getSouthProtocolSchema(protocol).then((schema) => {
      setConfigSchema(schema)
      updateForm(formData)
    })
  }, [])

  const handleChange = (data) => {
    const { formData } = data

    updateForm(formData)
  }
  const log = type => console.info.bind(console, type)
  return (
    <>
      {configJson && configSchema && (
        <Form
          formData={configJson}
          liveValidate
          schema={configSchema}
          // uiSchema={configureProtocol.uiModbus}
          autocomplete="on"
          onChange={handleChange}
          onSubmit={log('submitted')}
          onError={log('errors')}
        />
      )}
      <ReactJson src={configJson} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}

ConfigureProtocol.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}

export default withRouter(ConfigureProtocol)

ConfigureProtocol.schema = {
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
