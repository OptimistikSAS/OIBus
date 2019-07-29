// Context for Engine Json
// load engine on startup
// provide then json and a way to update as a reducer
import React from 'react'
import PropTypes from 'prop-types'

const reducer = (state, action) => {
  switch (action.type) {
    case 'update':
      return action.json
    case 'test':
      break
    default:
      break
  }
  return {}
}
const engineInitialState = {}
const EngineContext = React.createContext(engineInitialState)
const EngineProvider = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, engineInitialState)
  React.useEffect(() => {
    const getConfig = async () => {
      let mounted = true
      try {
        const response = await fetch('/config')
        const contentType = response.headers.get('content-type')
        if (!contentType || contentType.indexOf('application/json') === -1) throw new Error('bad header')
        const json = await response.json()
        if (mounted) dispatch({ type: 'update', json })
      } catch (error) {
        console.error(error)
        if (mounted) dispatch({ type: 'error', error })
      }
      return () => {
        mounted = false
      }
    }
    getConfig()
  }, [])
  return <EngineContext.Provider value={{ state, dispatch }}>{children}</EngineContext.Provider>
}

EngineProvider.propTypes = { children: PropTypes.element.isRequired }
export { EngineContext, EngineProvider }
