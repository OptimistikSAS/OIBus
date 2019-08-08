// Context for Engine Json
// load engine on startup
// provide then json and a way to update as a reducer
import React from 'react'
import PropTypes from 'prop-types'
import objectPath from 'object-path'
import apis from '../services/apis'


const reducer = (state, action) => {
  const { name, value, json, type, validity } = action
  const newState = Object.assign(Object.assign({}, state))
  switch (type) {
    case 'fetch':
      return json
    case 'update':
      newState.errors = validity
      objectPath.set(newState.config, name, value)
      return newState
    case 'saveEngine':
      // no change to state but save to server
      apis.updateEngine(state.config.engine)
      return state
    case 'deleteRow':
      objectPath.del(newState.config, name)
      return newState
    case 'addRow':
      objectPath.push(newState.config, name, action.value)
      // copy into the new state
      return newState
    default:
      throw new Error(`unknown action type: ${type}`)
  }
}
const engineInitialState = {}
const EngineContext = React.createContext(engineInitialState)
const EngineProvider = ({ children }) => {
  const [configState, configDispatch] = React.useReducer(reducer, engineInitialState)
  React.useEffect(() => {
    const getConfig = async () => {
      let mounted = true
      try {
        const response = await fetch('/config')
        const contentType = response.headers.get('content-type')
        if (!contentType || contentType.indexOf('application/json') === -1) throw new Error('bad header')
        const json = await response.json()
        if (mounted) configDispatch({ type: 'fetch', json })
      } catch (error) {
        console.error(error)
        throw error
      }
      return () => {
        mounted = false
        console.info('unmount')
      }
    }
    getConfig()
  }, [])
  return <EngineContext.Provider value={{ configState, configDispatch }}>{children}</EngineContext.Provider>
}

EngineProvider.propTypes = { children: PropTypes.element.isRequired }
export { EngineContext, EngineProvider }
