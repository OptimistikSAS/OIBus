import React from 'react'
import Form from 'react-jsonschema-form-bs4'

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
    <>
      <Form
        formData={configJson && configJson.engine}
        liveValidate
        schema={Engine.schema}
        uiSchema={Engine.uiSchema}
        autocomplete="on"
        onChange={log('changed')}
        onSubmit={log('submitted')}
        onError={log('errors')}
      />
      <pre>{configJson && JSON.stringify(configJson.engine, ' ', 2)}</pre>
    </>
  )
}

export default Engine

Engine.schema = {
  title: 'Engine',
  type: 'object',
  required: ['port', 'user', 'password'],
  properties: {
    port: { type: 'number', title: 'Port', default: 2223, minimum: 1, maximum: 65535 },
    user: { type: 'string', title: 'User', default: 'admin' },
    password: { type: 'string', title: 'Password', default: 'd74ff0ee8da3b9806b18c877dbf29bbde50b5bd8e4dad7a3a725000feb82e8f1' },
    filter: {
      type: 'array',
      title: 'filter',
      items: { type: 'string', oneOf: [{ format: 'ipv4' }, { format: 'ipv6' }] },
      minItems: 1,
      uniqueItems: true,
      default: ['127.0.0.1'],
    },
    logParameters: {
      type: 'object',
      title: 'Log Parameters',
      properties: {
        consoleLevel: { type: 'string', enum: ['debug', 'info', 'warning', 'error'], title: 'Console Level', default: 'debug' },
        fileLevel: { type: 'string', enum: ['debug', 'info', 'warning', 'error'], title: 'File Level', default: 'debug' },
        filename: { type: 'string', title: 'Filename', default: './logs/journal.log' },
        maxsize: { type: 'number', title: 'Max Size (Byte)', default: 1000000 },
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
        required: ['scanMode', 'cronTime'],
        properties: {
          scanMode: {
            type: 'string',
            title: 'Scan Mode',
          },
          cronTime: {
            type: 'string',
            title: 'Cron Time',
          },
        },
      },
    },
  },
}

Engine.uiSchema = {
  port: { 'ui:help': <div>The port to access the web interface to OIBus. Valid values range from 1 through 65535.</div> },
  password: { 'ui:widget': 'password' },
  filter: { 'ui:help': <div>The list of IP addresses allowed to access the Web interface</div> },
  logParameters: {
    tailable: {
      'ui:help': (
        <div>
          If true, log files will be rolled based on maxsize and maxfiles, but in ascending order. The filename will always have the most recent log
          lines. The larger the appended number, the older the log file. This option requires maxFiles to be set, or it will be ignored.
        </div>
      ),
    },
  },
  caching: {
    cacheFolder: { 'ui:help': <div>Where to store the cached data</div> },
    archiveFolder: { 'ui:help': <div>Required when archiveMode is &apos;archive&apos; for files</div> },
    archiveMode: { 'ui:help': <div> Move or delete files</div> },
  },
  scanModes: {
    'ui:help': (
      <div>
        Scan mode: name of the scan mode defined by the user
        <br />
        Cron time: interval for the scans
        <br />
        Example to scan every 5 seconds at 6am on the first day of each month in 2019
        <br />
        2019 * 1 6 * /5
        <br />
        <a href="https://github.com/paragi/timexe#readme"> For additional information, please refer the documentation of timexe.</a>
      </div>
    ),
  },
}
