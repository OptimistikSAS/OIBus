import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbTitle, OIbText, OIbSelect, OIbInteger, OIbPassword } from '../components/OIbForm'
import { ConfigContext } from '../context/configContext.jsx'
import validation from './Engine.validation'

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
      <OIbTitle label="Proxies">
        <p>
          Some north applications require to send informations through a proxy. Each proxy needs to be defined in this section and can be reused by
          other OIBus section. This section can be empty if you dont use proxies on your network.
        </p>
      </OIbTitle>
      <Row>
        <Col>
          <Table
            headers={['Name', 'Protocol', 'Host', 'Port', 'User', 'Password']}
            rows={proxies.map((proxy, i) => [
              {
                name: `engine.proxies.${i}.name`,
                value: (
                  <OIbText
                    name={`engine.proxies.${i}.name`}
                    value={proxy.name}
                    valid={validation.engine.proxies.name}
                    onChange={onChange}
                  />
                ),
              },
              {
                name: `engine.proxies.${i}.protocol`,
                value: <OIbSelect
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
                  <OIbText
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
                  <OIbInteger
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
                  <OIbText
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
                  <OIbPassword
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
