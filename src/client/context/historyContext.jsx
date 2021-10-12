import React from 'react'
import PropTypes from 'prop-types'
import objectPath from 'object-path'
import apis from '../services/apis'
import utils from '../helpers/utils'
import { ConfigContext } from './configContext.jsx'

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
        delete newState.errors[name]
        if (Object.keys(newState.errors).length === 0) delete newState.errors
      }
      objectPath.set(newState, name, value)
      return newState
    case 'deleteRow':
    {
      if (newState.errors) {
        const keys = Object.keys(newState.errors).filter((key) => key.startsWith(name))
        keys.forEach((key) => delete newState.errors[key])
        if (Object.keys(newState.errors).length === 0) delete newState.errors
      }
      objectPath.del(newState, name)
      return newState
    }
    case 'addRow':
      newState.push(value)
      return newState
    default:
      throw new Error(`unknown action type: ${type}`)
  }
}
const historyConfigInitialState = []
const HistoryConfigContext = React.createContext(historyConfigInitialState)
const HistoryConfigProvider = ({ children }) => {
  const [newHistoryConfig, dispatchNewHistoryConfig] = React.useReducer(reducer, historyConfigInitialState)
  const [activeHistoryConfig, setActiveHistoryConfig] = React.useState(null)
  const { protocolList, apiList } = React.useContext(ConfigContext)

  React.useEffect(() => {
    let mounted = true
    const fetchActiveHistoryConfig = async () => {
      try {
        const resp = await apis.getHistoryConfig()
        if (mounted && resp) {
          dispatchNewHistoryConfig({ type: 'reset', config: resp.config })
          setActiveHistoryConfig(utils.jsonCopy(resp.config))
        }
      } catch (error) {
        console.error(error)
      }
    }
    fetchActiveHistoryConfig()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <HistoryConfigContext.Provider
      value={{ newHistoryConfig, dispatchNewHistoryConfig, activeHistoryConfig, setActiveHistoryConfig, apiList, protocolList }}
    >
      {children}
    </HistoryConfigContext.Provider>
  )
}

HistoryConfigProvider.propTypes = { children: PropTypes.element.isRequired }
export { HistoryConfigContext, HistoryConfigProvider }
