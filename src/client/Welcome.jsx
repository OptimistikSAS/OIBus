import React from 'react'
import { Label, Button, Spinner } from 'reactstrap'
import { formatters, create } from 'jsondiffpatch'
import 'jsondiffpatch/dist/formatters-styles/html.css'
import Modal from './components/Modal.jsx'
import apis from './services/apis'

const Welcome = () => {
  const [configActiveJson, setConfigActiveJson] = React.useState(null)
  const [configJson, setConfigJson] = React.useState(null)
  const [loading, setLoading] = React.useState(null)

  const instance = create({
    objectHash: (obj, index) => {
      if (typeof obj.pointId !== 'undefined') {
        return obj.pointId
      }
      return `$$index:${index}`
    },
  })

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
  const isModified = true
  const delta = instance.diff(configActiveJson, configJson)
  const deltaHTML = formatters.html.format(delta)


  return (
    <>
      {isModified
        ? (
          <>
            <div className="oi-full-width">
              <div dangerouslySetInnerHTML={{ __html: deltaHTML }} />
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
      {loading ? <div className="spinner-container"><Spinner color="primary" /></div> : null}
    </>
  )
}
export default Welcome
