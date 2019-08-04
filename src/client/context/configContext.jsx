// Context for Engine Json
// load engine on startup
// provide then json and a way to update as a reducer
import React from 'react'
import PropTypes from 'prop-types'

const reducer = (state, action) => {
  const { name, json, value, type } = action
  let keys
  switch (type) {
    case 'update':
      return json
    case 'updateEngine':
      keys = name.split('.')
      if (keys[1]) { state.config.engine[keys[0]][keys[1]] = value } else { state.config.engine[keys[0]] = value }
      return Object.assign({}, state)
    default:
      break
  }
  return {}
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
      }
    }
    getConfig()
  }, [])
  return <EngineContext.Provider value={{ configState, configDispatch }}>{children}</EngineContext.Provider>
}

EngineProvider.propTypes = { children: PropTypes.element.isRequired }
export { EngineContext, EngineProvider }
