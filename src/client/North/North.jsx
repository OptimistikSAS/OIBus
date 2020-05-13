import React from 'react'
import { useHistory, Link } from 'react-router-dom'
import { Col, Spinner, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import NewApplicationRow from './NewApplicationRow.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import EditableIdField from '../components/EditableIdField.jsx'
import validation from './Form/North.validation'

const North = () => {
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig, apiList } = React.useContext(ConfigContext)
  const applications = newConfig?.north?.applications
  const history = useHistory()

  /**
   * Gets the config json of a north application
   * @param {string} applicationId ID of an application
   * @returns {object} The selected application's config
   */
  const getApplicationIndex = (applicationId) => applications.findIndex((application) => application.applicationId === applicationId)

  /**
   * Handles the edit of application and redirects the
   * user to the selected north applications's configuration page
   * @param {integer} index The id to edit
   * @return {void}
   */
  const handleEdit = (index) => {
    const application = applications[index]
    const link = `/north/${application.applicationId}`
    history.push({ pathname: link })
  }

  /**
   * Handles the change of one application id (name)
   * @param {integer} applicationIndex The index that will change
   * @param {string} newApplicationId The new application id
   * @return {void}
   */
  const handleApplicationIdChanged = (applicationIndex, newApplicationId) => {
    dispatchNewConfig({
      type: 'update',
      name: `north.applications.${applicationIndex}.applicationId`,
      value: newApplicationId,
    })
  }

  /**
   * Adds a new application row to the table
   * @param {Object} param0 An application object containing
   * applicationId, enabled and api fields
   * @returns {void}
   */
  const addApplication = ({ applicationId, api }) => {
    const applicationIndex = getApplicationIndex(applicationId)
    if (applicationIndex === -1) {
      // Adds new application
      dispatchNewConfig({ type: 'addRow', name: 'north.applications', value: { applicationId, api, enabled: false } })
    } else {
      const error = new Error('application already exists')
      setAlert({ text: error.message, type: 'danger' })
      throw error
    }
  }

  /**
   * Deletes the chosen application
   * @param {integer} index The id to delete
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewConfig({ type: 'deleteRow', name: `north.applications.${index}` })
  }

  const tableHeaders = ['Application ID', 'Status', 'API']
  const tableRows = applications?.map(({ applicationId, enabled, api }, index) => [
    {
      name: applicationId,
      value: (
        <EditableIdField
          id={applicationId}
          fromList={applications}
          index={index}
          name="applicationId"
          valid={validation.application.isValidName}
          idChanged={handleApplicationIdChanged}
        />
      ),
    },
    {
      name: 'enabled',
      value: <div className={enabled ? 'text-success' : 'text-danger'}>{enabled ? 'Enabled' : 'Disabled'}</div>,
    },
    { name: 'api', value: api },
  ])

  return tableRows && Array.isArray(apiList) ? (
    <Col md="6">
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          North
        </BreadcrumbItem>
      </Breadcrumb>
      <Table headers={tableHeaders} rows={tableRows} handleEdit={handleEdit} handleDelete={handleDelete} />
      <NewApplicationRow apiList={apiList} addApplication={addApplication} />
    </Col>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default North
