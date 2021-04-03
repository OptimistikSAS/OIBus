import React from 'react'
import { Label, Row, Breadcrumb, BreadcrumbItem, Container, Spinner } from 'reactstrap'
import { FaSync } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import NodeView from './NodeView.jsx'
import utils from '../helpers/utils'

const Health = () => {
  const [loading, setLoading] = React.useState()
  const [status, setStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)
  const config = utils.jsonCopy(activeConfig)
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

  // Disable loading when server reachable
  const stopLoadingWhenReachable = () => {
    apis
      .getConfig()
      .then(() => setLoading(false))
      // retry getConfig if error catched
      .catch(() => setTimeout(() => stopLoadingWhenReachable(), 1000))
  }

  /**
   * Restart request
   * @returns {void}
   */
  const handleRestart = async () => {
    try {
      await apis.reload()
      setLoading(true)
      // start checking if server is reachable after 10 sec,
      // as the restart on backend has a 10 sec delay
      setTimeout(() => stopLoadingWhenReachable(), 10000)
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  /**
   * Shutdown request
   * @returns {void}
   */
  const handleShutdown = async () => {
    try {
      await apis.shutdown()
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  /**
   * Generate string value from on object.
   * @param {Object[]} data - The object
   * @return {string} - The string value
   */
  const generateStringValueFromObject = (data) => {
    let stringValue = ''
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'name') {
        stringValue += stringValue ? ` / ${key}: ${value}` : `${key}: ${value}`
      }
    })
    return stringValue
  }

  /**
   * Generate row entry for the status table.
   * @param {string} key - The key
   * @param {string} value - The value
   * @return {[{name: *, value: *}, {name: string, value: *}]} - The table row
   */
  const generateRowEntry = (key, value) => [
    {
      name: key,
      value: key,
    },
    {
      name: 'value',
      value,
    },
  ]

  const tableRows = []
  Object.keys(status).forEach((key) => {
    if (Array.isArray(status[key])) {
      status[key].forEach((entry) => {
        tableRows.push(generateRowEntry(entry.name, generateStringValueFromObject(entry)))
      })
    } else {
      tableRows.push(generateRowEntry(key, status[key]))
    }
  })

  return (
    <>
      <Breadcrumb tag="h5">
        <BreadcrumbItem active tag="span">
          Home
        </BreadcrumbItem>
      </Breadcrumb>
      <Row>
        <Label>
          <span>
            {`${engineName} overview`}
            &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </span>
        </Label>
      </Row>
      <NodeView status={status} onRestart={handleRestart} onShutdown={handleShutdown} />
      <Row>
        <Label>
          <span>
            {`${engineName} health status`}
            &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </span>
        </Label>
      </Row>
      <Row>
        <Container>{tableRows && <Table headers={[]} rows={tableRows} />}</Container>
      </Row>
      {loading && (
        <div className="spinner-container">
          <Spinner color="primary" />
        </div>
      )}
    </>
  )
}
export default Health
