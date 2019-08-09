// Context for Engine Json
// load engine on startup
// provide then json and a way to update as a reducer
import React from 'react'
import PropTypes from 'prop-types'
import objectPath from 'object-path'
import apis from '../services/apis'

const reducer = (state, action) => {
  const { name, value, config, type, validity } = action
  const newState = JSON.parse(JSON.stringify(state))
  switch (type) {
    case 'reset':
      return JSON.parse(JSON.stringify(config))
    case 'update':
      if (!newState.errors) newState.errors = {}
      newState.errors[name] = validity
      objectPath.set(newState, name, value)
      return newState
    case 'deleteRow':
      objectPath.del(newState, name)
      return newState
    case 'addRow':
      objectPath.push(newState, name, action.value)
      // copy into the new state
      return newState
    default:
      throw new Error(`unknown action type: ${type}`)
  }
}
const configInitialState = null
const ConfigContext = React.createContext(configInitialState)
const ConfigProvider = ({ children }) => {
  const [newConfig, dispatchNewConfig] = React.useReducer(reducer, configInitialState)
  const [activeConfig, setActiveConfig] = React.useState(null)
  // On mount, acquire the Active config from server.
  React.useEffect(() => {
    let mounted = true
    const fetchActiveConfig = async () => {
      try {
        const { config } = await apis.getActiveConfig()
        if (mounted) {
          dispatchNewConfig({ type: 'reset', config })
          setActiveConfig(JSON.parse(JSON.stringify(config)))
        }
      } catch (error) {
        console.error(error)
      }
    }
    fetchActiveConfig()
    return () => {
      mounted = false
      console.info('unmount')
    }
  }, [])
  // the provider return the new and active config and their respective setters
  return <ConfigContext.Provider value={{ newConfig, dispatchNewConfig, activeConfig, setActiveConfig }}>{children}</ConfigContext.Provider>
}

ConfigProvider.propTypes = { children: PropTypes.element.isRequired }
export { ConfigContext, ConfigProvider }
