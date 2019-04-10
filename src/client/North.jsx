import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ConfigService from './services/configService'
import Table from './components/table/Table.jsx'

const tableHeaders = ['Application ID', 'Enabled', 'API']

const North = ({ history }) => {
  const [configJson, setConfigJson] = React.useState()
  const [tableRows, setTableRows] = React.useState()

  /**
   * Sets the content of the table
   * @param {object} config The configuration json
   * @returns {void} no return value
   */
  const createTableRows = (config) => {
    const array = []
    config.applications.forEach((application) => {
      const { applicationId, enabled, api } = application
      array.push([applicationId, enabled.toString(), api])
    })

    setTableRows(array)
  }

  React.useEffect(() => {
    ConfigService.getConfig().then(({ config }) => {
      setConfigJson(config.north)
      createTableRows(config.north)
    })
  }, [])

  /**
   * Gets the config json of a north application
   * @param {string} applicationId ID of an application
   * @returns {object} The selected application's config
   */
  const getApplicationData = (applicationId) => {
    let formData = {}
    configJson.applications.forEach((application) => {
      if (application.applicationId === applicationId) {
        formData = application
      }
    })

    return formData
  }

  /**
   * Handles the click of the table rows and redirects the
   * user to the selected north application's configuration page
   * @param {array} application Data of the clicked row
   * @return {void}
   */
  const handleClick = (application) => {
    const [applicationId] = application
    const formData = getApplicationData(applicationId)
    const link = `/north/${formData.api}`
    history.push({ pathname: link, formData })
  }

  return (
    <>
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleClick} />}
      <pre>{configJson && JSON.stringify(configJson, ' ', 2)}</pre>
    </>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(North)
