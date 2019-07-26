import React from 'react'
import { Alert } from 'reactstrap'
import { AlertContext } from '../context/AlertContext'

const AlertContainer = () => {
  const { alert, setAlert } = React.useContext(AlertContext)

  return (
    <div>
      {alert ? (
        <Alert color={alert.type || 'info'} toggle={() => setAlert()}>
          {alert.text || 'Something went wrong, please try again later'}
        </Alert>
      ) : null }
    </div>
  )
}

export default AlertContainer
