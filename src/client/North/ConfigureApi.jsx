import React from 'react'
import { useParams } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import { ConfigContext } from '../context/ConfigContext.jsx'
import NorthForm from './Form/NorthForm.jsx'

const ConfigureApi = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const applications = newConfig?.north?.applications // array of all defined applications
  const { id } = useParams()
  const applicationIndex = applications?.findIndex((application) => application.id === id)

  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }
  return applicationIndex >= 0 ? (
    <NorthForm
      application={applications[applicationIndex]}
      applicationIndex={applicationIndex}
      onChange={onChange}
    />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default ConfigureApi
