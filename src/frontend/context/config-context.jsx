// Context for Engine Json
// load engine on startup
// provide then json and a way to update as a reducer
import React from 'react'
import PropTypes from 'prop-types'
import objectPath from 'object-path'
import apis from '../service/apis.js'
import utils from '../helpers/utils.js'

const reducer = (state, action) => {
  const { name, value, config, type, validity } = action
  const newState = utils.jsonCopy(state)
  switch (type) {
    case 'reset':
      return utils.jsonCopy(config)
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
      objectPath.set(newState, name, value)
      return newState
    default:
      throw new Error(`unknown action type: ${type}`)
  }
}
const configInitialState = {}
const ConfigContext = React.createContext(configInitialState)
const ConfigProvider = ({ children }) => {
  const [newConfig, dispatchNewConfig] = React.useReducer(reducer, configInitialState)
  const [activeConfig, setActiveConfig] = React.useState(null)
  const [northTypes, setNorthTypes] = React.useState()
  const [southTypes, setSouthTypes] = React.useState()
  // context for sorting south/north list
  const [sortNorthBy, setSortNorthBy] = React.useState()
  const [isNorthAscending, setIsNorthAscending] = React.useState()
  const [sortSouthBy, setSortSouthBy] = React.useState()
  const [isSouthAscending, setIsSouthAscending] = React.useState()
  const sort = {
    sortNorthBy,
    setSortNorthBy,
    isNorthAscending,
    setIsNorthAscending,
    sortSouthBy,
    setSortSouthBy,
    isSouthAscending,
    setIsSouthAscending,
  }

  /**
   * Acquire the list of North Types
   * @returns {void}
   */
  React.useEffect(() => {
    const call = async () => {
      try {
        setNorthTypes(await apis.getNorthTypes())
      } catch (error) {
        console.error(error)
      }
    }
    call()
  }, [])

  /**
   * Acquire the list of South Types
   * @returns {void}
   */
  React.useEffect(() => {
    const call = async () => {
      try {
        setSouthTypes(await apis.getSouthTypes())
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
        const resp = await apis.getConfig()
        if (mounted && resp) {
          dispatchNewConfig({ type: 'reset', config: resp.config })
          // parse/stringify to create deep copy:
          setActiveConfig(utils.jsonCopy(resp.config))
        }
      } catch (error) {
        console.error(error)
      }
    }
    fetchActiveConfig()
    return () => {
      mounted = false
    }
  }, [])

  const configValueProvided = React.useMemo(
    () => ({ newConfig, dispatchNewConfig, activeConfig, setActiveConfig, northTypes, southTypes, sort }),
    [newConfig, dispatchNewConfig, activeConfig, setActiveConfig, northTypes, southTypes, sort],
  )
  // the provider return the new and active config and their respective setters
  /**
   * @todo: component using this context (.i.e the whole application) will rerender
   * 4 times (when northTypes, southTypes, activeConfig and newConfig are updated).
   * we could make a single call to the server to avoid this effect.
   */
  return (
    <ConfigContext.Provider
      value={configValueProvided}
    >
      {children}
    </ConfigContext.Provider>
  )
}

ConfigProvider.propTypes = { children: PropTypes.element.isRequired }
export { ConfigContext, ConfigProvider, reducer }
