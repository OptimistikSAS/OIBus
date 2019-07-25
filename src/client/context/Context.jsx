import React from 'react'
import PropTypes from 'prop-types'

import { AlertProvider } from './AlertContext'

const Context = ({ children }) => {
  const [alert, setAlert] = React.useState()

  return (
    <>
      <AlertProvider value={{ alert, setAlert }}>
        {children}
      </AlertProvider>
    </>
  )
}
Context.propTypes = { children: PropTypes.node.isRequired }
export default Context
