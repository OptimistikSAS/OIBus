import React from 'react'
import { Label, Row, Button } from 'reactstrap'
import { FaSync } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import utils from '../helpers/utils'


const Health = () => {
  const [status, setStatus] = React.useState([])
  const [showConfig, setShowConfig] = React.useState(false)
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)
  const config = JSON.parse(JSON.stringify(activeConfig))
  utils.replaceValues(config, ['password', 'secretKey'], '******')

  /**
   * Acquire the status
   * @returns {void}
   */
  const fetchStatus = () => {
    apis.getStatus().then((response) => {
      setStatus(response)
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }
  /**
   * Fetch status after render
   * @returns {void}
   */
  React.useEffect(() => {
    fetchStatus()
  }, [])

  const tableRows = Object.keys(status).map((key) => (
    [
      {
        name: key,
        value: key,
      },
      {
        name: 'value',
        value: status[key],
      },
    ]
  ))

  const renderConfigurationJson = () => (
    <Row>
      <pre>{JSON.stringify(config, undefined, 2)}</pre>
    </Row>
  )

  return (
    <>
      <Row>
        <Label>
          <span>
            Health status&nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </span>
        </Label>
        {tableRows && <Table headers={[]} rows={tableRows} />}
        <Button color="primary" onClick={() => setShowConfig(!showConfig)}>
          Configuration File
        </Button>
      </Row>
      {showConfig ? renderConfigurationJson() : null}
    </>
  )
}
export default Health
