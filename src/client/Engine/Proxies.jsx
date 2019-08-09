import React from 'react'
import PropTypes from 'prop-types'
import { Col, Row } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbTitle, OIbText, OIbSelect, OIbInteger, OIbPassword } from '../components/OIbForm'
import { ConfigContext } from '../context/configContext.jsx'

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
      value: { name: '', protocol: '', host: '', port: '', username: '', password: '' },
    })
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
                  name: `engine.proxies.${i}.name`,
                  value: (
                    <OIbText
                      name={`engine.proxies.${i}.name`}
                      value={proxy.name}
                      valid={(val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2')}
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: `engine.proxies.${i}.protocol`,
                  value: <OIbSelect name={`engine.proxies.${i}.protocol`} options={['http', 'https']} option={proxy.protocol} onChange={onChange} />,
                },
                {
                  name: `engine.proxies.${i}.host`,
                  value: (
                    <OIbText
                      name={`engine.proxies.${i}.host`}
                      value={proxy.host}
                      valid={(val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2')}
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
                      valid={(val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535')}
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
                      valid={(val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2')}
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
                      valid={(val) => (/^.{2,}$/.test(val) ? null : 'Length should be greater than 2')}
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
