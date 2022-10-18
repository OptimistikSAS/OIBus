import React from 'react'
import { Alert } from 'reactstrap'
import { AlertContext } from '../context/alert-context.jsx'

const AlertContainer = () => {
  const {
    alert,
    setAlert,
  } = React.useContext(AlertContext)

  return alert ? (
    <Alert color={alert.type || 'info'} toggle={() => setAlert()}>
      {alert.text || 'Something went wrong, please try again later'}
    </Alert>
  ) : null
}

export default AlertContainer
