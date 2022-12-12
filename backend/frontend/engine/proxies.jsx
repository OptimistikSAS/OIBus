import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import Table from '../components/table/table.jsx'
import { OibTitle, OibText, OibSelect, OibInteger, OibPassword } from '../components/oib-form/index.js'
import { ConfigContext } from '../context/config-context.jsx'
import validation from './engine.validation.js'

const Proxies = ({ proxies }) => {
  const { dispatchNewConfig } = React.useContext(ConfigContext)
  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `engine.proxies.${rowIndex}` })
  }
  const handleAdd = () => {
    dispatchNewConfig({
      type: 'addRow',
      name: 'engine.proxies',
      value: { name: 'name', protocol: 'http', host: '', port: '', username: '', password: '' },
    })
  }
  return (
    <>
      <OibTitle label="Proxies">
        <p>
          Some North connectors require to send information through a proxy. Each proxy needs to be defined in this section and can be reused by
          other OIBus section. This section can be empty if you dont use proxies on your network.
        </p>
      </OibTitle>
      <Row>
        <Col>
          <Table
            headers={['Name', 'Protocol', 'Host', 'Port', 'User', 'Password']}
            rows={proxies.map((proxy, i) => [
              {
                name: `engine.proxies.${i}.name`,
                value: (
                  <OibText
                    name={`engine.proxies.${i}.name`}
                    value={proxy.name}
                    valid={validation.engine.proxies.name}
                    onChange={onChange}
                  />
                ),
              },
              {
                name: `engine.proxies.${i}.protocol`,
                value: <OibSelect
                  name={`engine.proxies.${i}.protocol`}
                  options={['http', 'https']}
                  defaultValue="http"
                  value={proxy.protocol}
                  onChange={onChange}
                />,
              },
              {
                name: `engine.proxies.${i}.host`,
                value: (
                  <OibText
                    name={`engine.proxies.${i}.host`}
                    value={proxy.host}
                    valid={validation.engine.proxies.host}
                    onChange={onChange}
                  />
                ),
              },
              {
                name: `engine.proxies.${i}.port`,
                value: (
                  <OibInteger
                    name={`engine.proxies.${i}.port`}
                    value={proxy.port}
                    defaultValue=""
                    valid={validation.engine.proxies.port}
                    onChange={onChange}
                  />
                ),
              },
              {
                name: `engine.proxies.${i}.username`,
                value: (
                  <OibText
                    name={`engine.proxies.${i}.username`}
                    value={proxy.username}
                    valid={validation.engine.proxies.username}
                    onChange={onChange}
                  />
                ),
              },
              {
                name: `engine.proxies.${i}.password`,
                value: (
                  <OibPassword
                    name={`engine.proxies.${i}.password`}
                    value={proxy.password}
                    valid={validation.engine.proxies.password}
                    onChange={onChange}
                  />
                ),
              },
            ])}
            handleDelete={handleDelete}
            handleAdd={handleAdd}
          />
        </Col>
      </Row>
    </>
  )
}

Proxies.propTypes = { proxies: PropTypes.arrayOf(Object).isRequired }

export default Proxies
