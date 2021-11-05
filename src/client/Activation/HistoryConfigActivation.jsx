import React from 'react'
import { Label } from 'reactstrap'
import { formatters, create } from 'jsondiffpatch'
import 'jsondiffpatch/dist/formatters-styles/html.css'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import utils from '../helpers/utils'
import ConfigDiffRenderer from './components/ConfigDiffRenderer.jsx'
import ConfigJsonRenderer from './components/ConfigJsonRenderer.jsx'
import { HistoryConfigContext } from '../context/historyContext.jsx'
import ActionButtons from './components/ActionButtons.jsx'

const HistoryConfigActivation = () => {
  const [loading, setLoading] = React.useState(null)
  const { setAlert } = React.useContext(AlertContext)
  const { newHistoryConfig, dispatchNewHistoryConfig, activeHistoryConfig, setActiveHistoryConfig } = React.useContext(HistoryConfigContext)

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
      .getHistoryConfig()
      .then(() => setLoading(false))
    // retry getConfig if error catched
      .catch(() => setTimeout(() => stopLoadingWhenReachable(), 1000))
  }
  // button to activate the modified configuration
  const handleActivate = async () => {
    try {
      await apis.updateHistoryConfig(newHistoryConfig)
      await apis.activateHistoryConfig()
      setActiveHistoryConfig(newHistoryConfig)
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
      dispatchNewHistoryConfig({ type: 'reset', config: utils.jsonCopy(activeHistoryConfig) })
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  let delta
  let diffError
  try {
    delta = diffInstance.diff(activeHistoryConfig, newHistoryConfig)
  } catch (e) {
    console.error('Diff cannot be done: ', e.message)
    diffError = 'Diff cannot be done'
  }

  const isModified = delta !== undefined || diffError !== undefined
  const deltaHTML = isModified && formatters.html.format(delta)
  return (
    <>
      <pre>{newHistoryConfig && JSON.stringify(newHistoryConfig.errors)}</pre>
      {isModified ? (
        <>
          <ActionButtons onConfirm={handleActivate} onDecline={handleDecline} errors={newHistoryConfig.errors} />
          <ConfigDiffRenderer deltaHTML={deltaHTML} diffError={diffError} />
        </>
      ) : (
        <Label>No modifications on history configuration</Label>
      )}
      <ConfigJsonRenderer loading={loading} newConfig={newHistoryConfig} activeConfig={activeHistoryConfig} isModified={isModified} />
    </>
  )
}

export default HistoryConfigActivation
