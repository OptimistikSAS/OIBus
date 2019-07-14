import React from 'react'
import { Label, Button, Spinner } from 'reactstrap'
import { ReactGhLikeDiff } from 'react-gh-like-diff'
import stringify from 'json-stable-stringify'
import 'react-gh-like-diff/lib/diff2html.min.css'
import Modal from './components/Modal.jsx'
import apis from './services/apis'

const Welcome = () => {
  const [configActiveJson, setConfigActiveJson] = React.useState(null)
  const [configJson, setConfigJson] = React.useState(null)
  const [loading, setLoading] = React.useState(null)

  /**
   * Acquire the Active configuration
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getActiveConfig().then(({ config }) => {
      setConfigActiveJson(config)
    })
  }, [])

  /**
   * Acquire the Current Modified configuration
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getConfig().then(({ config }) => {
      setConfigJson(config)
    })
  }, [])

  /**
   * Check if modified is changed compared to active
   * @param {string} active The current active config JSON string
   * @param {string} modified The current modified config JSON string
   * @returns {boolean} compare result
   */
  const compareActiveWithModified = (active, modified) => (active && modified && (active !== modified))

  /**
   * Disable loading when server reachable
   * @returns {void}
   */
  const stopLoadingWhenReachable = () => {
    apis.getConfig()
      .then(() => setLoading(false))
      // retry getConfig if error catched
      .catch(() => setTimeout(() => stopLoadingWhenReachable(), 1000))
  }

  /**
   * Activate new configuration
   * @returns {void}
   */
  const handleActivate = async () => {
    try {
      await apis.updateActiveConfig()
      setConfigActiveJson(configJson)
      setLoading(true)
      stopLoadingWhenReachable()
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Reset modified configuration
   * @returns {void}
   */
  const handleDecline = async () => {
    try {
      await apis.resetModifiedConfig()
      setConfigJson(configActiveJson)
    } catch (error) {
      console.error(error)
    }
  }

  // json-stable-stringify is used instead of JSON.stringify to have consistent result in alphabetical order
  const activeString = stringify(configActiveJson, { space: '  ' })
  const modifiedString = stringify(configJson, { space: '  ' })
  const isModified = compareActiveWithModified(activeString, modifiedString)

  return (
    <>
      {isModified
        ? (
          <>
            <div className="oi-full-width">
              <ReactGhLikeDiff
                options={{
                  originalFileName: 'Configuration',
                  updatedFileName: 'Configuration',
                }}
                past={activeString}
                current={modifiedString}
              />
            </div>
            <Modal show={false} title="Server restart" body="The server will restart to activate the new configuration">
              {(confirm) => (
                <Button color="primary" onClick={confirm(handleActivate)}>
                  Activate
                </Button>
              )}
            </Modal>
            <Button color="primary" onClick={() => handleDecline()}>
              Decline
            </Button>
          </>
        )
        : <Label>No modifications on configuration</Label>
      }
      {loading ? <div className="spinner-container"><Spinner color="primary" /></div> : null }
    </>
  )
}
export default Welcome
