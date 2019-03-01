import React from 'react'
import Form from 'react-jsonschema-form'

// import { } from 'reactstrap'

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
  const log = type => console.log.bind(console, type)
  return (
    <>
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
    </>
  )
}

export default Engine

Engine.schema = {
  title: 'Engine',
  type: 'object',
  required: ['port', 'user', 'password'],
  properties: {
    port: { type: 'number', title: 'Port', default: '2223' },
    user: { type: 'string', title: 'User', default: 'admin' },
    password: { type: 'string', title: 'Password', default: 'd74ff0ee8da3b9806b18c877dbf29bbde50b5bd8e4dad7a3a725000feb82e8f1' },
  },
}

Engine.uiSchema = {
  port: { 'ui:help': <div>the port for the web interface to fTbus</div> },
  password: { 'ui:widget': 'password' },
  adresses: { 'ui:help': <div>the list of IP addresses allowed to access the Web interface</div> },
}
