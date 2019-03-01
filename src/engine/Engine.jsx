import React from 'react'
import Form from 'react-jsonschema-form'

const Engine = () => {
  const [configJson, setConfigJson] = React.useState()
  React.useEffect(() => {
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
  return (
    <div>
      <h1>Engine</h1>
      <Form
        formData={configJson && configJson.engine}
        schema={Engine.schema}
        uiSchema={Engine.uiSchema}
        autocomplete="on"
        onChange={log('changed')}
        onSubmit={log('submitted')}
        onError={log('errors')}
      />
      <pre>{configJson && JSON.stringify(configJson.engine, ' ', 2)}</pre>
    </div>
  )
}

export default Engine

Engine.schema = {
  title: 'Engine',
  type: 'object',
  required: ['port', 'user', 'password'],
  properties: {
    port: { type: 'number', title: 'Port', default: 2223 },
    user: { type: 'string', title: 'User', default: 'admin' },
    password: { type: 'string', title: 'Password', default: 'd74ff0ee8da3b9806b18c877dbf29bbde50b5bd8e4dad7a3a725000feb82e8f1' },
    filter: { type: 'array', title: 'filter', items: { type: 'string' }, minItems: 1, uniqueItems: true, default: ['127.0.0.1'] },
    logParameters: {
      type: 'object',
      title: 'Log Parameters',
      properties: {
        consoleLevel: { type: 'string', title: 'Console Level', default: 'debug' },
        fileLevel: { type: 'string', title: 'File Level', default: 'debug' },
        filename: { type: 'string', title: 'Filename', default: './logs/journal.log' },
        maxsize: { type: 'number', title: 'Max Size', default: 1000000 },
        maxFiles: { type: 'number', title: 'Max Files', default: 5 },
        tailable: { type: 'boolean', title: 'Tailable', default: true },
      },
    },
    caching: {
      type: 'object',
      title: 'Caching Parameters',
      properties: {
        cacheFolder: { type: 'string', title: 'Cache Folder', default: './cache' },
        archiveFolder: { type: 'string', title: 'Archive Folder', default: './cache/archived/' },
        archiveMode: { type: 'string', enum: ['archive', 'delete'], title: 'Archive Mode', default: 'archive' },
      },
    },
    scanModes: {
      type: 'array',
      title: 'Scan Modes',
      items: {
        type: 'object',
        required: ['ScanMode', 'cronTime'],
        properties: {
          scanMode: {
            type: 'string',
            title: 'Scan Mode',
            description: 'Name of the scan mode',
          },
          cronTime: {
            type: 'string',
            title: 'Cron Time',
            description: 'Enter with the cron syntax',
          },
        },
      },
    },
  },
}

Engine.uiSchema = {
  port: { 'ui:help': <div>the port for the web interface to fTbus</div> },
  password: { 'ui:widget': 'password' },
  filter: { 'ui:help': <div>the list of IP addresses allowed to access the Web interface</div> },
}
