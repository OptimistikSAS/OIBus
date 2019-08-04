import React from 'react'
import { Col, Row, Form } from 'reactstrap'
import { EngineContext } from '../context/configContext.jsx'
import { AlertContext } from '../context/AlertContext.js'
import { OIbInteger, OIbText, OIbPassword } from '../components/OIbForm'
import Filters from './Filters.jsx'
import Logging from './Logging.jsx'
import ScanModes from './ScanModes.jsx'
import Proxies from './Proxies.jsx'
import Caching from './Caching.jsx'

const Engine = () => {
  // eslint-disable-next-line no-unused-vars
  const { state: configState, dispatch: configDispatch } = React.useContext(EngineContext)
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

  const onChange = (name, value) => {
    console.info('set json avec la nouvelle valeur', name, value)
    /*
    setConfigJson((json) => {
      json[name] = value
      return json
    })
    */
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
              regExp={/^.{2,}$/}
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
      <pre>{JSON.stringify(configState)}</pre>
    </>
  ) : null
}

export default Engine
