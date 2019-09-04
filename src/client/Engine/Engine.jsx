import React from 'react'
import { Col, Row, Form, Spinner } from 'reactstrap'
import { ConfigContext } from '../context/configContext.jsx'
import { OIbInteger, OIbText, OIbPassword, OIbTitle } from '../components/OIbForm'
import Filters from './Filters.jsx'
import Logging from './Logging.jsx'
import ScanModes from './ScanModes.jsx'
import Proxies from './Proxies.jsx'
import Caching from './Caching.jsx'
import validation from '../helpers/validation'

const Engine = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  // const { setAlert } = React.useContext(AlertContext)
  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }
  return newConfig ? (
    <>
      <Form>
        <OIbTitle title="Engine Parameters">
          <>
            <p>In this section, you must define:</p>
            <ul>
              <li>The number of the port to access OIBus. The default value is 2223 can be kept unless it conflicts with an existing value.</li>
              <li>
                The user name and password that will be used to access this console. Make sure the default password is changed to avoid unauthorized
                access.
              </li>
            </ul>
          </>
        </OIbTitle>
        <Row>
          <Col md={2}>
            <OIbInteger
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
            <OIbText
              name="engine.user"
              label="Admin user name"
              value={newConfig.engine.user}
              valid={validation.engine.user}
              defaultValue="admin"
              onChange={onChange}
              help={<div>The username of the Admin user</div>}
            />
          </Col>
          <Col md={3}>
            <OIbPassword
              label="Admin Password"
              name="engine.password"
              onChange={onChange}
              valid={validation.engine.password}
              value={newConfig.engine.password}
              help={<div>The password of the Admin user</div>}
            />
          </Col>
        </Row>
        <Filters onChange={onChange} filters={newConfig.engine.filter} />
        <Logging onChange={onChange} logParameters={newConfig.engine.logParameters} />
        <ScanModes onChange={onChange} scanModes={newConfig.engine.scanModes} />
        <Caching onChange={onChange} caching={newConfig.engine.caching} />
        <Proxies onChange={onChange} proxies={newConfig.engine.proxies} />
      </Form>
    </>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default Engine
