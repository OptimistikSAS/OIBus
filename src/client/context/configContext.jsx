// Context for Engine Json
// load engine on startup
// provide then json and a way to update as a reducer
import React from 'react'
import PropTypes from 'prop-types'
import objectPath from 'object-path'
import apis from '../services/apis'
import utils from '../helpers/utils'

const reducer = (state, action) => {
  const { name, value, config, type, validity } = action
  const newState = JSON.parse(JSON.stringify(state))
  switch (type) {
    case 'reset':
      return JSON.parse(JSON.stringify(config))
    case 'update':
      if (!newState.errors) newState.errors = {}
      if (validity) {
        newState.errors[name] = validity
      } else {
        // clean the error object
        delete newState.errors[name]
        if (Object.keys(newState.errors).length === 0) delete newState.errors
      }
      objectPath.set(newState, name, value)
      return newState
    case 'deleteRow':
    {
      // clean the error object
      if (newState.errors) {
        const keys = Object.keys(newState.errors).filter((key) => key.startsWith(name))
        keys.forEach((key) => delete newState.errors[key])
        if (Object.keys(newState.errors).length === 0) delete newState.errors
      }
      objectPath.del(newState, name)
      return newState
    }
    case 'deleteAllRows':
      objectPath.empty(newState, name)
      return newState
    case 'addRow':
      objectPath.push(newState, name, value)
      // copy into the new state
      return newState
    case 'importPoints':
      objectPath.set(newState, name, utils.parseCSV(value, ','))
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
  const [apiList, setApiList] = React.useState()
  const [protocolList, setProtocolList] = React.useState()

  /**
   * Acquire the list of API
   * @returns {void}
   */
  React.useEffect(() => {
    const call = async () => {
      try {
        setApiList(await apis.getNorthApis())
      } catch (error) {
        console.error(error)
      }
    }
    call()
  }, [])

  /**
   * Acquire the list of Protocols
   * @returns {void}
   */
  React.useEffect(() => {
    const call = async () => {
      try {
        setProtocolList(await apis.getSouthProtocols())
      } catch (error) {
        console.error(error)
      }
    }
    call()
  }, [])

  // On mount, acquire the Active config from server.
  React.useEffect(() => {
    let mounted = true
    const fetchActiveConfig = async () => {
      try {
        const resp = await apis.getActiveConfig()
        if (mounted && resp) {
          dispatchNewConfig({ type: 'reset', config: resp.config })
          // parse/stringify to create deep copy:
          setActiveConfig(JSON.parse(JSON.stringify(resp.config)))
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
  /**
   * @todo: component using this context (.i.e the whole application) will rerender
   * 4 times (when apiList, protocolList, activeConfig and newConfig are updated).
   * we could make a single call to the server to avoid this effect.
   */
  return (
    <ConfigContext.Provider
      value={{ newConfig, dispatchNewConfig, activeConfig, setActiveConfig, apiList, protocolList }}
    >
      {children}
    </ConfigContext.Provider>
  )
}

ConfigProvider.propTypes = { children: PropTypes.element.isRequired }
export { ConfigContext, ConfigProvider }
