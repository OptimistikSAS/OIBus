import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbTitle, OIbText, OIbSelect, OIbInteger, OIbPassword } from '../components/OIbForm'
import { EngineContext } from '../context/configContext.jsx'

const Proxies = ({ proxies }) => {
  const { configDispatch } = React.useContext(EngineContext)
  const onChange = (name, value, validity) => {
    configDispatch({ type: 'updateEngine', name, value, validity })
  }
  const handleDelete = (rowIndex) => {
    console.info('delete', rowIndex)
    configDispatch({ type: 'deleteRow', name: 'engine.proxies', rowIndex })
  }
  const handleAdd = () => {
    configDispatch({ type: 'addRow', name: 'engine.proxies', value: { name: '', protocol: '', host: '', port: '', username: '', password: '' } })
  }
  return (
    proxies && (
      <>
        <OIbTitle title="Proxies">
          <p>
            Some north applications requires to send informations through a proxy. Each proxy needs to be defined in this section and can be reused by
            other OIBus section. This section can be left empty if you dont use proxies on your network.
          </p>
        </OIbTitle>
        <Row>
          <Col>
            <Table
              headers={['Name', 'Protocol', 'Host', 'Port', 'User', 'Password']}
              rows={proxies.map((proxy, i) => [
                {
                  name: `proxies.${i}.name`,
                  value: (
                    <OIbText
                      name={`proxies.${i}.name`}
                      value={proxy.name}
                      regExp={/^.{2,}$/} // i.e. min size = 2
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: `proxies.${i}.protocol`,
                  value: <OIbSelect name={`proxies.${i}.protocol`} options={['http', 'https']} option={proxy.protocol} onChange={onChange} />,
                },
                {
                  name: `proxies.${i}.host`,
                  value: (
                    <OIbText
                      name={`proxies.${i}.host`}
                      value={proxy.host}
                      regExp={/^.{2,}$/} // i.e. min size = 2
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: `proxies.${i}.port`,
                  value: <OIbInteger name={`proxies.${i}.port`} value={proxy.port} min={1} max={65535} onChange={onChange} />,
                },
                {
                  name: `proxies.${i}.username`,
                  value: (
                    <OIbText
                      name={`proxies.${i}.username`}
                      value={proxy.username}
                      regExp={/^.{2,}$/} // i.e. min size = 2
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: `proxies.${i}.password`,
                  value: (
                    <OIbPassword
                      name={`proxies.${i}.password`}
                      value={proxy.password}
                      regExp={/^.{2,}$/} // i.e. min size = 2
                      onChange={onChange}
                    />
                  ),
                },
              ])}
              onRowClick={() => null}
              handleDelete={handleDelete}
              handleAdd={handleAdd}
            />
          </Col>
        </Row>
      </>
    )
  )
}

Proxies.propTypes = { proxies: PropTypes.arrayOf(Object).isRequired }

export default Proxies

// ['http', 'https'], default: 'http'
