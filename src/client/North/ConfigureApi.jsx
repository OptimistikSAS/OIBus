import React from 'react'
import { withRouter } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import PropTypes from 'prop-types'
import { ConfigContext } from '../context/configContext.jsx'
import NorthForm from './NorthForm.jsx'

const ConfigureApi = ({ match }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const applications = newConfig && newConfig.north.applications // array of all defined applications
  const { applicationId } = match.params // the applicationId passed in the url
  const applicationIndex = applications && applications.findIndex((application) => application.applicationId === applicationId)

  const onChange = (name, value, validity) => {
    // add the proper index
    dispatchNewConfig({ type: 'update', name: `north.applications.${applicationIndex}.${name}`, value, validity })
  }

  return applications ? (
    <NorthForm application={applications[applicationIndex]} onChange={onChange} />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

ConfigureApi.propTypes = { match: PropTypes.object.isRequired }
export default withRouter(ConfigureApi)
