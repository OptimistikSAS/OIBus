import React from 'react'
import { withRouter } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import PropTypes from 'prop-types'
import { ConfigContext } from '../context/configContext.jsx'
import NorthForm from './Form/NorthForm.jsx'

const ConfigureApi = ({ match, history }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const applications = newConfig && newConfig.north.applications // array of all defined applications
  const { applicationId, index } = match.params // the applicationId passed in the url or index passed
  const applicationIndex = index
    ? Number(index) : (applications && applications.findIndex((application) => application.applicationId === applicationId))
  // create list with other applications name, for rename error
  const otherApplications = applications.filter((e, i) => i !== applicationIndex).map((application) => application.applicationId)

  const onChange = (name, value, validity) => {
    if (name === 'applicationId') {
      const link = `/north/applicationIndex/${applicationIndex}`
      history.push({ pathname: link })
    }
    dispatchNewConfig({ type: 'update', name: `north.applications.${applicationIndex}.${name}`, value, validity })
  }
  return applications ? (
    <NorthForm
      otherApplications={otherApplications}
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

ConfigureApi.propTypes = { match: PropTypes.object.isRequired, history: PropTypes.object.isRequired }
export default withRouter(ConfigureApi)
