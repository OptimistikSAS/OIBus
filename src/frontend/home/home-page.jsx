import React from 'react'
import { Spinner } from 'reactstrap'
import apis from '../service/apis'
import { AlertContext } from '../context/alert-context.jsx'
import { ConfigContext } from '../context/config-context.jsx'
import NodeView from './node-view.jsx'
import utils from '../helpers/utils'

const HomePage = () => {
  const [loading, setLoading] = React.useState(false)
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)
  const config = utils.jsonCopy(activeConfig)
  utils.replaceValues(config, ['password', 'secretKey'], '******')

  // Disable loading when server reachable
  const stopLoadingWhenReachable = () => {
    apis
      .getConfig()
      .then(() => setLoading(false))
      // retry getConfig if error caught
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
      <NodeView onRestart={handleRestart} onShutdown={handleShutdown} />
      {loading && (
        <div className="spinner-container">
          <Spinner color="primary" />
        </div>
      )}
    </>
  )
}
export default HomePage
