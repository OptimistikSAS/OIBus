import React from 'react'
import { Label, Button, Spinner } from 'reactstrap'
import { formatters, create } from 'jsondiffpatch'
import 'jsondiffpatch/dist/formatters-styles/html.css'
import Modal from './components/Modal.jsx'
import apis from './services/apis'
import { AlertContext } from './context/AlertContext'

const Welcome = () => {
  const [configActiveJson, setConfigActiveJson] = React.useState(null)
  const [configJson, setConfigJson] = React.useState(null)
  const [loading, setLoading] = React.useState(null)
  const { setAlert } = React.useContext(AlertContext)
  const maxDiffLength = 10000

  const diffInstance = create({
    objectHash: (obj, index) => {
      // allow to diff the point list array correctly
      if (typeof obj.pointId !== 'undefined') {
        return obj.pointId
      }
      // allow to diff the scanmode list array correctly
      if (typeof obj.scanMode !== 'undefined') {
        return obj.scanMode
      }
      // allow to diff the proxy list array correctly
      if (typeof obj.name !== 'undefined') {
        return obj.name
      }
      // allow to diff the north list array correctly
      if (typeof obj.applicationId !== 'undefined') {
        return obj.applicationId
      }
      // allow to diff the south list array correctly
      if (typeof obj.dataSourceId !== 'undefined') {
        return obj.dataSourceId
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
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }, [])

  /**
   * Acquire the Current Modified configuration
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getConfig().then(({ config }) => {
      setConfigJson(config)
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
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
      setAlert({ text: error.message, type: 'danger' })
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
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  const delta = diffInstance.diff(configActiveJson, configJson)
  const isModified = !!delta
  const deltaHTML = formatters.html.format(delta)

  return (
    <>
      {isModified
        ? (
          <>
            <div className="oi-full-width">
              {deltaHTML.length > maxDiffLength
                ? <Label>The configuration difference is too large to display</Label>
                // eslint-disable-next-line react/no-danger
                : <div dangerouslySetInnerHTML={{ __html: deltaHTML }} />
              }
            </div>
            <div className="force-row-display">
              <Modal show={false} title="Server restart" body="The server will restart to activate the new configuration">
                {(confirm) => (
                  <Button className="inline-button" color="primary" onClick={confirm(handleActivate)}>
                    Activate
                  </Button>
                )}
              </Modal>
              <Button className="inline-button" color="primary" onClick={() => handleDecline()}>
                Decline
              </Button>
            </div>
          </>
        )
        : <Label>No modifications on configuration</Label>
      }
      {loading ? <div className="spinner-container"><Spinner color="primary" /></div> : null}
    </>
  )
}
export default Welcome
