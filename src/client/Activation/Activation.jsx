import React from 'react'
import { Label, Button, Spinner, Container } from 'reactstrap'
import ReactJson from 'react-json-view'
import { formatters, create } from 'jsondiffpatch'
import 'jsondiffpatch/dist/formatters-styles/html.css'
import Modal from '../components/Modal.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/ConfigContext.jsx'
import utils from '../helpers/utils'
import { OIbTitle } from '../components/OIbForm'

const Activation = () => {
  const [loading, setLoading] = React.useState(null)
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig, activeConfig, setActiveConfig } = React.useContext(ConfigContext)
  const MAX_DIFF_LENGTH = 10000
  // function to help the diff library
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
      return `$$index:${index}`
    },
  })
  // Disable loading when server reachable
  const stopLoadingWhenReachable = () => {
    apis
      .getConfig()
      .then(() => setLoading(false))
      // retry getConfig if error catched
      .catch(() => setTimeout(() => stopLoadingWhenReachable(), 1000))
  }
  // button to activate the modified configuration
  const handleActivate = async () => {
    try {
      await apis.updateConfig(newConfig)
      await apis.activateConfig()
      setActiveConfig(newConfig)
      setLoading(true)
      stopLoadingWhenReachable()
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }
  // button to remove modification to the config
  const handleDecline = async () => {
    try {
      dispatchNewConfig({ type: 'reset', config: utils.jsonCopy(activeConfig) })
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  /**
   * replace secret values in delta
   * @param {Object} delta diff delta
   * @returns {String} html delta formatted
   */
  const removeSecretValues = (delta) => {
    const deltaCopy = utils.jsonCopy(delta)
    utils.replaceValues(deltaCopy, ['password', 'secretKey'], '******', true)
    return formatters.html.format(deltaCopy)
  }

  let delta
  let diffError
  try {
    delta = diffInstance.diff(activeConfig, newConfig)
  } catch (e) {
    console.error('Diff cannot be done: ', e.message)
    diffError = 'Diff cannot be done'
  }

  const isModified = delta !== undefined || diffError !== undefined
  const deltaHTML = isModified && removeSecretValues(delta)
  return (
    <Container fluid>
      <div className="ml-3 pt-3">
        <OIbTitle label="Modifications">
          <div>
            <p>Modifications requested on the OIBus configuration are listed below</p>
            <p>The ACTIVE configuration is the one currently used by the OIBus server</p>
            <p>It will be replaced with the new configuration if you use the activate button</p>
            <p>The NEW configuration is the one that will be used OIBus server AFTER the activation</p>
          </div>
        </OIbTitle>
      </div>
      <pre>{newConfig && JSON.stringify(newConfig.errors)}</pre>
      {isModified ? (
        <>
          <div className="force-row-display">
            <Modal show={false} title="Server restart" body="The server will restart to activate the new configuration">
              {(confirm) => (
                <Button
                  className="inline-button"
                  color="primary"
                  onClick={confirm(handleActivate)}
                  disabled={newConfig.errors !== undefined}
                >
                  Activate
                </Button>
              )}
            </Modal>
            <Button className="inline-button" color="primary" onClick={() => handleDecline()}>
              Decline
            </Button>
          </div>
          <div className="oi-full-width">
            {diffError ? <Label>{diffError}</Label> : null}
            {deltaHTML.length > MAX_DIFF_LENGTH ? (
              <Label>The configuration difference is too large to display</Label>
            ) : (
              // eslint-disable-next-line react/no-danger
              <div dangerouslySetInnerHTML={{ __html: deltaHTML }} />
            )}
          </div>
        </>
      ) : (
        <Label>No modifications on configuration</Label>
      )}
      {loading ? (
        <div className="spinner-container">
          <Spinner color="primary" />
        </div>
      ) : null}
      {activeConfig && (
        <ReactJson
          src={activeConfig}
          name="Active configuration"
          collapsed
          displayObjectSize={false}
          displayDataTypes={false}
          enableClipboard
          collapseStringsAfterLength={100}
        />
      )}
      {newConfig && isModified && (
        <ReactJson
          src={newConfig}
          name="New configuration"
          collapsed
          displayObjectSize={false}
          displayDataTypes={false}
          enableClipboard
          collapseStringsAfterLength={100}
        />
      )}
    </Container>
  )
}
export default Activation
