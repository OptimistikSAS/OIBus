// Context for Engine Json
// load engine on startup
// provide then json and a way to update as a reducer
import React from 'react'
import PropTypes from 'prop-types'
import apis from '../services/apis'

const reducer = (state, action) => {
  const { name, value, json, type, validity } = action
  let keys
  let newState
  switch (type) {
    case 'update':
      return json
    case 'saveEngine':
      // will not modify the state but save to server
      apis.updateEngine(state.config.engine)
      return state
    case 'updateEngine':
      newState = Object.assign(Object.assign({}, state))
      newState.errors = validity
      keys = name.split('.')
      /** @todo: make this recursive would allow to support any number */
      switch (keys.length) {
        case 1:
          state.config.engine[keys[0]] = value
          break
        case 2:
          state.config.engine[keys[0]][keys[1]] = value
          break
        case 3:
          state.config.engine[keys[0]][keys[1]][keys[2]] = value
          break
        default:
          throw new Error(`name ${name} should have 0 to 2 points max`)
      }
      return newState
    case 'updateFilters':
      newState = Object.assign(Object.assign({}, state))
      newState.errors = validity
      console.info('ici', validity, name, value)
      /*
      keys = name.split('.')
      if (keys[1]) {
        state.config.engine[keys[0]][keys[1]] = value
      } else {
        state.config.engine[keys[0]] = value
      }
      */
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
        if (mounted) configDispatch({ type: 'update', json })
      } catch (error) {
        console.error(error)
        if (mounted) configDispatch({ type: 'error', error })
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
