import React from 'react'
import { Label } from 'reactstrap'
import { create, formatters } from 'jsondiffpatch'
import 'jsondiffpatch/dist/formatters-styles/html.css'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/ConfigContext.jsx'
import utils from '../helpers/utils'
import ConfigDiffRenderer from './components/ConfigDiffRenderer.jsx'
import ConfigJsonRenderer from './components/ConfigJsonRenderer.jsx'
import ActionButtons from './components/ActionButtons.jsx'

const MainConfigActivation = () => {
  const [loading, setLoading] = React.useState(null)
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig, activeConfig, setActiveConfig } = React.useContext(ConfigContext)

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
    <>
      <pre>{newConfig && JSON.stringify(newConfig.errors)}</pre>
      {isModified ? (
        <div>
          <ActionButtons onConfirm={handleActivate} onDecline={handleDecline} errors={newConfig.errors} />
          <ConfigDiffRenderer deltaHTML={deltaHTML} diffError={diffError} />
        </div>
      ) : (
        <Label>No modifications on main configuration</Label>
      )}
      <ConfigJsonRenderer loading={loading} newConfig={newConfig} activeConfig={activeConfig} isModified={isModified} />
    </>
  )
}

export default MainConfigActivation
