import React from 'react'
import PropTypes from 'prop-types'

const AlertContext = React.createContext({})

const AlertProvider = ({ children }) => {
  const [alert, setAlert] = React.useState({})

  const alertValueProvided = React.useMemo(() => ({ alert, setAlert }), [alert, setAlert])
  return (
    <AlertContext.Provider value={alertValueProvided}>
      {children}
    </AlertContext.Provider>
  )
}
AlertProvider.propTypes = { children: PropTypes.node.isRequired }

export { AlertContext, AlertProvider }
