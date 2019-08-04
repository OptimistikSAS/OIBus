import React from 'react'
import { Col, Row, Form, Spinner } from 'reactstrap'
import { EngineContext } from '../context/configContext.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { OIbInteger, OIbText, OIbPassword } from '../components/OIbForm'
import Filters from './Filters.jsx'
import Logging from './Logging.jsx'
import ScanModes from './ScanModes.jsx'
import Proxies from './Proxies.jsx'
import Caching from './Caching.jsx'

const Engine = () => {
  const { configState, configDispatch } = React.useContext(EngineContext)
  const { setAlert } = React.useContext(AlertContext)

  const onChange = (name, value, validity) => {
    console.info('dispatch:', name, value, validity)
    configDispatch({ type: 'updateEngine', name, value, validity })
  }
  const { error, config } = configState
  if (error) setAlert({ text: error, type: 'danger' })
  return config ? (
    <>
      <Form>
        <h1>Engine Parameters</h1>
        <Row form>
          <Col md={3}>
            <OIbInteger
              name="port"
              label="Port"
              value={config.engine.port}
              min={1}
              max={65535}
              help={<div>The port to access the Admin interface</div>}
              onChange={onChange}
            />
          </Col>
          <Col md={3}>
            <OIbText
              name="user"
              label="Admin user name"
              value={config.engine.user}
              regExp={/^.{2,}$/} // i.e. min size = 2
              onChange={onChange}
              help={<div>The username of the Admin user</div>}
            />
          </Col>
          <Col md={3}>
            <OIbPassword
              label="Admin Password"
              name="password"
              onChange={onChange}
              regExp={/^.{4,}$/}
              value={configState.config.engine.password}
              help={<div>The password of the Admin user</div>}
            />
          </Col>
        </Row>
        <Logging onChange={onChange} logParameters={configState.config.engine.logParameters} />
        <Filters onChange={onChange} filters={configState.config.engine.filter} />
        <Caching onChange={onChange} caching={configState.config.engine.caching} />
        <Proxies onChange={onChange} proxies={configState.config.engine.proxies} />
        <ScanModes onChange={onChange} scanModes={configState.config.engine.scanModes} />
      </Form>
      <pre>{JSON.stringify(configState.config)}</pre>
    </>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default Engine
