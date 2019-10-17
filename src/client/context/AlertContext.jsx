import React from 'react'
import PropTypes from 'prop-types'

const AlertContext = React.createContext({})

const AlertProvider = ({ children }) => {
  const [alert, setAlert] = React.useState({})
  return (
    <>
      <AlertContext.Provider value={{ alert, setAlert }}>
        {children}
      </AlertContext.Provider>
    </>
  )
}
AlertProvider.propTypes = { children: PropTypes.node.isRequired }

export { AlertContext, AlertProvider }
