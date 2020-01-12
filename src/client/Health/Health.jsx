import React from 'react'
import { Label, Row } from 'reactstrap'
import { FaSync } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import Overview from './Overview.jsx'
import utils from '../helpers/utils'

const Health = () => {
  const [status, setStatus] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)
  const config = JSON.parse(JSON.stringify(activeConfig))
  utils.replaceValues(config, ['password', 'secretKey'], '******')
  const engineName = activeConfig?.engine.engineName ?? ''

  /**
   * Acquire the status
   * @returns {void}
   */
  const fetchStatus = () => {
    apis
      .getStatus()
      .then((response) => {
        setStatus(response)
      })
      .catch((error) => {
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

  const tableRows = Object.keys(status).map((key) => [
    {
      name: key,
      value: key,
    },
    {
      name: 'value',
      value: status[key],
    },
  ])

  return (
    <>
      <Row>
        <Label>
          <span>
            {`${engineName} overview`}
            &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </span>
        </Label>
      </Row>
      <Overview />
      <Row>
        <Label>
          <span>
            {`${engineName} health status`}
            &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </span>
        </Label>
      </Row>
      <Row>{tableRows && <Table headers={[]} rows={tableRows} />}</Row>
    </>
  )
}
export default Health
