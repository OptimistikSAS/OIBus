import React from 'react'
import { Col, Row, Form, Spinner, Container } from 'reactstrap'
import { ConfigContext } from '../context/config-context.jsx'
import { OibInteger, OibText, OibPassword, OibTitle, OibCheckbox } from '../components/oib-form/index.js'
import Filters from './filters.jsx'
import Logging from './logging/logging.jsx'
import ScanModes from './scan-modes.jsx'
import Proxies from './proxies.jsx'
import HealthSignal from './health-signal.jsx'
import ExternalSources from './external-sources.jsx'
import validation from './engine.validation.js'

const Engine = () => {
  const {
    newConfig,
    dispatchNewConfig,
  } = React.useContext(ConfigContext)
  const onChange = (name, value, validity) => {
    dispatchNewConfig({
      type: 'update',
      name,
      value,
      validity,
    })
  }
  return newConfig?.engine ? (
    <Container fluid>
      <Form className="m-2 pt-3">
        <OibTitle label="Engine Parameters">
          <>
            <p>In this section, you must define:</p>
            <ul>
              <li>The name of this OIBus (only used for description purpose).</li>
              <li>
                The number of the port to access OIBus. The default value (2223) can be kept unless it conflicts with an
                existing value.
              </li>
              <li>
                The user name and password that will be used to access this console. Make sure the default password is
                changed to avoid unauthorized access. The password is encrypted with a local private key. To reset the
                password, you need to access the OIbus server and remove the password key in the OIBus configuration
                file. It will reset to the default password that will have to be changed.
              </li>
              <li>
                With safe mode enabled OIBus will start only the web server for configuration.
              </li>
            </ul>
          </>
        </OibTitle>
        <Row>
          <Col md={2}>
            <OibText
              name="engine.name"
              label="Engine name"
              value={newConfig.engine.name}
              valid={validation.engine.name}
              defaultValue="OIBus"
              onChange={onChange}
              help={<div>The name to this OIBus used for identification. It must be as much explicit as possible</div>}
            />
          </Col>
          <Col md={2}>
            <OibInteger
              name="engine.port"
              label="Port"
              value={newConfig.engine.port}
              defaultValue={2223}
              valid={validation.engine.port}
              help={<div>The port to access the Admin interface</div>}
              onChange={onChange}
            />
          </Col>
        </Row>
        <Row>
          <Col md={3}>
            <OibText
              name="engine.user"
              label="Admin username"
              value={newConfig.engine.user}
              valid={validation.engine.user}
              defaultValue="admin"
              onChange={onChange}
              help={<div>The username of the Admin user</div>}
            />
          </Col>
          <Col md={3}>
            <OibPassword
              label="Admin Password"
              name="engine.password"
              onChange={onChange}
              valid={validation.engine.password}
              value={newConfig.engine.password}
              help={<div>The password of the Admin user</div>}
            />
          </Col>
        </Row>
        <Row>
          <Col md={2}>
            <OibCheckbox
              name="engine.safeMode"
              label="Safe mode"
              value={newConfig.engine.safeMode}
              defaultValue={false}
              onChange={onChange}
              help={<div>When safe mode is active OIBus only starts the web server for configuration</div>}
            />
          </Col>
        </Row>
        <Filters onChange={onChange} filters={newConfig.engine.filter} />
        <Logging onChange={onChange} logParameters={newConfig.engine.logParameters} />
        <ScanModes onChange={onChange} scanModes={newConfig.engine.scanModes} />
        <Proxies onChange={onChange} proxies={newConfig.engine.proxies || []} />
        <HealthSignal onChange={onChange} healthSignal={newConfig.engine.healthSignal} />
        <ExternalSources onChange={onChange} externalSources={newConfig.engine.externalSources} />
      </Form>
    </Container>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default Engine
