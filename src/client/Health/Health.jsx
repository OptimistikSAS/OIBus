import React from 'react'
import { Label, Row, Breadcrumb, BreadcrumbItem, Spinner } from 'reactstrap'
import { FaSync } from 'react-icons/fa'
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

  return (
    <>
      <Breadcrumb tag="h4">
        <BreadcrumbItem active tag="span">
          Home
        </BreadcrumbItem>
      </Breadcrumb>
      <Row>
        <Label>
          <h6>
            {`${engineName} overview`}
            &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </h6>
        </Label>
      </Row>
      <NodeView status={status} onRestart={handleRestart} onShutdown={handleShutdown} />

      {loading && (
        <div className="spinner-container">
          <Spinner color="primary" />
        </div>
      )}
    </>
  )
}
export default Health
