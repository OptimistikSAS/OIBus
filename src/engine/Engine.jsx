import React from 'react'
import { Col, Row, Button, Form, FormGroup, Label, Input, FormText, FormFeedback } from 'reactstrap'
import { EngineContext } from '../client/context/configContext.jsx'
import { AlertContext } from '../client/context/AlertContext.js'

const Engine = () => {
  // const [configJson, setConfigJson] = React.useState()
  const [validate, setValidate] = React.useState()
  const { state: configState /* , dispatch: configDispatch */ } = React.useContext(EngineContext)

  const { setAlert } = React.useContext(AlertContext)

  /**
   * Submit the updated engine
   * @param {*} engine The changed engine
   * @returns {void}
   */
  /*
 const handleSubmit = async (engine) => {
   console.log(engine)
   try {
     await apis.updateEngine(engine)
   } catch (error) {
     console.error(error)
     setAlert({ text: error.message, type: 'danger' })
   }
}
   */

  const validateEmail = (e) => {
    // eslint-disable-next-line max-len
    const emailRex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    if (emailRex.test(e.target.value)) {
      setValidate('has-success')
    } else {
      setValidate('has-danger')
    }
  }

  const handleChange = (event) => {
    validateEmail(event)
    const { target } = event
    const value = target.type === 'checkbox' ? target.checked : target.value
    const { name } = target
    console.info('set json avec la nouvelle valeur', name, value)

    /*
    setConfigJson((json) => {
      json[name] = value
      return json
    })
    */
  }
  console.info(configState)
  if (configState && configState.error) setAlert({ text: configState.error, type: 'danger' })
  return configState ? (
    <>
      <Form>
        <Row form>
          <Col md={6}>
            <FormGroup>
              <Label for="exampleEmail">Email</Label>
              <Input
                type="email"
                name="email"
                id="exampleEmail"
                placeholder="with a placeholder"
                invalid={validate === 'has-danger'}
                onChange={handleChange}
              />
              <FormFeedback>Oh noes! that name is not good</FormFeedback>
              <FormText>Example help text.</FormText>
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label for="examplePassword">Password</Label>
              <Input type="password" name="password" id="examplePassword" placeholder="password placeholder" />
            </FormGroup>
          </Col>
        </Row>
        <FormGroup>
          <Label for="exampleAddress">Address</Label>
          <Input type="text" name="address" id="exampleAddress" placeholder="1234 Main St" />
        </FormGroup>
        <FormGroup>
          <Label for="exampleAddress2">Address 2</Label>
          <Input type="text" name="address2" id="exampleAddress2" placeholder="Apartment, studio, or floor" />
        </FormGroup>
        <Row form>
          <Col md={6}>
            <FormGroup>
              <Label for="exampleCity">City</Label>
              <Input type="text" name="city" id="exampleCity" />
            </FormGroup>
          </Col>
          <Col md={4}>
            <FormGroup>
              <Label for="exampleState">State</Label>
              <Input type="text" name="state" id="exampleState" />
            </FormGroup>
          </Col>
          <Col md={2}>
            <FormGroup>
              <Label for="exampleZip">Zip</Label>
              <Input type="text" name="zip" id="exampleZip" />
            </FormGroup>
          </Col>
        </Row>
        <FormGroup check>
          <Input type="checkbox" name="check" id="exampleCheck" />
          <Label for="exampleCheck" check>
            Check me out
          </Label>
        </FormGroup>
        <Button>Sign in</Button>
      </Form>
      <pre>{JSON.stringify(configState)}</pre>
    </>
  ) : null
}

export default Engine

Engine.schema = {
  title: 'Engine',
  type: 'object',
  required: ['port', 'user', 'password'],
  properties: {
    port: { type: 'number', title: 'Port', default: 2223, minimum: 1, maximum: 65535 },
    user: { type: 'string', title: 'User', default: 'admin' },
    password: {
      type: 'string',
      title: 'Password',
      default: 'd74ff0ee8da3b9806b18c877dbf29bbde50b5bd8e4dad7a3a725000feb82e8f1',
    },
    filter: {
      type: 'array',
      title: 'Network Filter',
      items: { type: 'string' },
      minItems: 1,
      uniqueItems: true,
      default: ['127.0.0.1'],
    },
    logParameters: {
      type: 'object',
      title: 'Log Parameters',
      properties: {
        consoleLevel: {
          type: 'string',
          enum: ['silly', 'debug', 'info', 'warning', 'error'],
          title: 'Console Level',
          default: 'debug',
        },
        fileLevel: {
          type: 'string',
          enum: ['silly', 'debug', 'info', 'warning', 'error'],
          title: 'File Level',
          default: 'debug',
        },
        filename: { type: 'string', title: 'Filename', default: './logs/journal.log' },
        maxsize: { type: 'number', title: 'Max Size (Byte)', default: 1000000 },
        maxFiles: { type: 'number', title: 'Max Files', default: 5 },
        tailable: { type: 'boolean', title: 'Tailable', default: true },
        sqliteLevel: {
          type: 'string',
          enum: ['silly', 'debug', 'info', 'warning', 'error'],
          title: 'SQLite logging Level',
          default: 'debug',
        },
        sqliteFilename: { type: 'string', title: 'Filename', default: './logs/journal.db' },
        sqliteMaxFileSize: {
          type: 'number',
          title: 'Max File Size When To Start Deleting Old Log Records (Byte)',
          default: 5000000,
        },
      },
    },
    caching: {
      type: 'object',
      title: 'Cache Parameters',
      properties: {
        cacheFolder: { type: 'string', title: 'Cache Folder', default: './cache' },
        archiveFolder: { type: 'string', title: 'Archive Folder', default: './cache/archived/' },
        archiveMode: { type: 'string', enum: ['archive', 'delete'], title: 'Archive Mode', default: 'archive' },
      },
    },
    proxies: {
      type: 'array',
      title: 'Proxy Parameters',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Name',
          },
          protocol: {
            type: 'string',
            enum: ['http', 'https'],
            title: 'Protocol',
            default: 'http',
          },
          host: {
            type: 'string',
            title: 'Host',
          },
          port: {
            type: 'number',
            title: 'Port',
          },
          username: {
            type: 'string',
            title: 'Username',
          },
          password: {
            type: 'string',
            title: 'Password',
          },
        },
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
  port: { 'ui:help': <div>The port to access the Admin interface. Valid values range from 1 through 65535.</div> },
  password: { 'ui:widget': 'password' },
  filter: { 'ui:help': <div>The list of IP addresses or hostnames allowed to access the Admin interface</div> },
  logParameters: {
    tailable: {
      'ui:help': (
        <div>
          If true, log files will be rolled based on maxsize and maxfiles, but in ascending order. The filename will
          always have the most recent log lines. The larger the appended number, the older the log file. This option
          requires maxFiles to be set, or it will be ignored.
        </div>
      ),
    },
  },
  caching: {
    cacheFolder: { 'ui:help': <div>Where to store the cached data</div> },
    archiveFolder: { 'ui:help': <div>Required when archiveMode is &apos;archive&apos; for files</div> },
    archiveMode: { 'ui:help': <div> Move or delete files</div> },
  },
  proxies: { items: { password: { 'ui:widget': 'password' } } },
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
      </div>
    ),
  },
}
