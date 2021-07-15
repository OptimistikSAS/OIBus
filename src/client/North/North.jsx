import React from 'react'
import { useHistory, Link } from 'react-router-dom'
import { Col, Spinner, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import NewApplicationRow from './NewApplicationRow.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import EditableIdField from '../components/EditableIdField.jsx'
import validation from './Form/North.validation'
import utils from '../helpers/utils'

const North = () => {
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig, apiList, sort } = React.useContext(ConfigContext)
  const { sortNorthBy: sortBy, setSortNorthBy: setSortBy } = sort
  const { isNorthAscending: isAscending, setIsNorthAscending: setIsAscending } = sort
  const applications = newConfig?.north?.applications
  const history = useHistory()

  // create a sortable copy to matain original order in case of sort
  const sortableApplications = utils.jsonCopy(applications ?? [])
  // add index for each north application for later use in case of sort
  sortableApplications?.forEach((application, index) => {
    application.index = index
  })
  // sort based on selected property
  if (sortBy !== undefined) {
    sortableApplications.sort((a, b) => {
      if (a[sortBy].toString().toLowerCase() > b[sortBy].toString().toLowerCase()) return isAscending ? 1 : -1
      if (b[sortBy].toString().toLowerCase() > a[sortBy].toString().toLowerCase()) return isAscending ? -1 : 1
      return 0
    })
  }

  /**
   * Gets the index of a north application
   * @param {string} applicationId ID of an application
   * @returns {object} The selected application's config
   */
  const getApplicationIndex = ((applicationId) => {
    const position = sortableApplications.findIndex((application) => application.applicationId === applicationId)
    if (position === -1) {
      return position
    }
    return sortableApplications[position].index
  })

  /**
   * Handles the edit of application and redirects the
   * user to the selected north applications's configuration page
   * @param {integer} position The id to edit
   * @return {void}
   */
  const handleEdit = (position) => {
    const application = sortableApplications[position]
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
   * @param {integer} position The index to delete
   * @returns {void}
   */
  const handleDelete = (position) => {
    dispatchNewConfig({ type: 'deleteRow', name: `north.applications.${sortableApplications[position].index}` })
  }

  /**
   * Copy the chosen application
   * @param {integer} position The id to copy
   * @returns {void}
   */
  const handleDuplicate = (position) => {
    const application = applications[sortableApplications[position].index]
    const newName = `${application.applicationId} copy`
    const countCopies = applications.filter((e) => e.applicationId.startsWith(newName)).length
    dispatchNewConfig({
      type: 'addRow',
      name: 'north.applications',
      value: {
        ...application,
        applicationId: `${newName}${countCopies > 0 ? countCopies + 1 : ''}`,
        enabled: false,
      },
    })
  }

  /**
  * Sort applications list
  * @param {string} property to be used for sorting
  * @param {bool} ascending flag for ascending/descending
  * @returns {void}
  */
  const handleSort = (property, ascending) => {
    setSortBy(property)
    setIsAscending(ascending)
  }

  const tableHeaders = ['Application ID', 'Status', 'API']
  const sortableProperties = ['applicationId', 'enabled', 'api']
  const tableRows = sortableApplications?.map(({ applicationId, enabled, api, index }) => [
    {
      name: applicationId,
      value: (
        <EditableIdField
          id={applicationId}
          fromList={sortableApplications}
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
    <Col md="6" className="north">
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          North
        </BreadcrumbItem>
      </Breadcrumb>
      <Table
        headers={tableHeaders}
        sortableProperties={sortableProperties}
        sortBy={sortBy}
        isAscending={isAscending}
        rows={tableRows}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        handleDuplicate={handleDuplicate}
        handleSort={handleSort}
      />
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
