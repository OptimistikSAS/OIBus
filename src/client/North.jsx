import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import ConfigService from './services/configService'
import Table from './components/table/Table.jsx'
import NewApplicationRow from './NewApplicationRow.jsx'

const North = ({ history }) => {
  const [applications, setApplications] = React.useState([])
  const [apiList, setApiList] = React.useState([])

  // acquire the North configuration
  React.useEffect(() => {
    ConfigService.getConfig().then(({ config }) => {
      setApplications(config.north.applications)
    })
  }, [])

  // acquire the list of Apis
  React.useEffect(() => {
    ConfigService.getNorthApis().then((apis) => {
      setApiList(apis)
    })
  }, [])

  /**
   * Gets the config json of a north application
   * @param {string} applicationId ID of an application
   * @returns {object} The selected application's config
   */
  const getApplicationIndex = applicationId => applications.findIndex(application => application.applicationId === applicationId)

  /**
   * Handles the click of the table rows and redirects the
   * user to the selected north application's configuration page
   * @param {array} application Data of the clicked row
   * @return {void}
   */
  const handleRowClick = (application) => {
    const [applicationId] = application
    const applicationIndex = getApplicationIndex(applicationId)

    // return if no id is provided
    if (applicationIndex === -1) return
    const formData = applications[applicationIndex]
    const link = `/north/${formData.api}`
    history.push({ pathname: link, formData })
  }

  /**
   * Adds a new application row to the table
   * @param {Object} param0 An application object containing
   * applicationId, enabled and api fields
   * @returns {void}
   */
  const addApplication = ({ applicationId, enabled, api }) => {
    const equipmentIndex = getApplicationIndex(applicationId)
    if (equipmentIndex === -1) {
      setApplications(prev => [...prev, { applicationId, enabled, api }])
    } else {
      throw new Error('application already exists')
    }
  }

  const tableHeaders = ['Application ID', 'Enabled', 'Api']
  const tableRows = applications.map(({ applicationId, enabled, api }) => [applicationId, enabled ? 'enabled' : '', api])
  return (
    <>
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleRowClick} />}
      <NewApplicationRow apiList={apiList} addApplication={addApplication} />
      <ReactJson src={applications} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(North)
