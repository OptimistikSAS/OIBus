import React from 'react'
import { Spinner } from 'reactstrap'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import NodeView from './NodeView.jsx'
import utils from '../helpers/utils'

const HomePage = () => {
  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)
  const config = utils.jsonCopy(activeConfig)
  utils.replaceValues(config, ['password', 'secretKey'], '******')

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
      <NodeView status={status} onRestart={handleRestart} onShutdown={handleShutdown} />
      {loading && (
        <div className="spinner-container">
          <Spinner color="primary" />
        </div>
      )}
    </>
  )
}
export default HomePage
