import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Form, Button, Input, FormGroup, Label } from 'reactstrap'
// import Form from 'react-jsonschema-form-bs4'
import Table from '../client/components/table/Table.jsx'
import TablePagination from '../client/components/table/TablePagination.jsx'
import Modal from '../client/components/Modal.jsx'
import apis from '../client/services/apis'
// import uiSchema from './uiSchema.jsx'
import { AlertContext } from '../client/context/AlertContext.jsx'
import { ConfigContext } from '../client/context/configContext.jsx'

const ConfigureProtocol = ({ match }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const [filterText, setFilterText] = React.useState() // used to limit the list of points
  const [filteredPoints, setFilteredPoints] = React.useState([]) // filtered list
  const [selectedPage, setSelectedPage] = React.useState(1)
  const { setAlert } = React.useContext(AlertContext)
  // max points on one page
  const MAX_ON_PAGE = 10
  // this value will be used to calculate the amount of max pagination displayed
  const MAX_PAGINATION_DISPLAY = 11

  const { dataSourceId } = match.params
  const { points } = newConfig.south[dataSourceId]

  /**
   * Update the filtered points JSON
   * @param {string} filter filter value
   * @returns {void}
   */
  const updateFilteredPoints = (filter) => {
    setFilteredPoints(
      filter
        ? points.filter(
          (point) => Object.values(point).findIndex((element) => element
            .toString()
            .toLowerCase()
            .includes(filter.toLowerCase())) >= 0,
        )
        : points,
    )
  }

  /**
   * Sets the filter text
   * @param {string} value filter value
   * @returns {void}
   */
  const updateFilterText = (value) => {
    setSelectedPage(1)
    setFilterText(value)
    updateFilteredPoints(points, value)
  }

  /**
   * add point
   * @returns {void}
   */
  const handleAdd = () => {
    dispatchNewConfig({ type: 'addPoint', dataSourceId })
  }

  /**
   * Delete point
   * @param {string} pointId the id of point
   * @returns {void}
   */
  const handleDelete = (pointId) => {
    dispatchNewConfig({ type: 'deletePoint', dataSourceId, pointId })
  }

  /**
   * Delete all points
   * @returns {void}
   */
  const handleDeleteAllPoint = () => {
    dispatchNewConfig({ type: 'deleteAllPoints', dataSourceId })
  }

  /**
   * Read content of file as text
   * @param {Object} file the file returned by input
   * @returns {void}
   */
  const readFileContent = async (file) => new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onload = () => {
      resolve(reader.result)
    }
  })

  /**
   * Send the imported file content to the backend
   * @param {Object} file the file returned by input
   * @returns {void}
   */
  const handleImportPoints = async (file) => {
    const text = await readFileContent(file)
    const { datasourceid } = match.params
    dispatchNewConfig({ type: 'importPoints', datasourceid, text })
  }

  /**
   * Download export file of points
   * @returns {void}
   */
  const handleExportPoints = () => {
    const { datasourceid } = match.params
    apis.exportAllPoints(datasourceid).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }

  /**
   * create one cell with the value
   * @param {string} value the displayed value
   * @returns {void}
   */
  const createCell = (value) => <div>{value}</div>

  /**
   * create the array with cells on a particular row
   * this function is recursive, it will work recursiveli once the schema has objects
   * @param {Object} config of the points from the protocol
   * @param {Object} point data of one point
   * @returns {Array} array with name-value for the cells
   */
  const createTableRow = (config, point) => {
    const keys = Object.keys(config)
    let row = []
    keys.forEach((key) => {
      if (config[key].type !== 'object') {
        row.push({
          name: key,
          value: createCell(point[key] ? point[key].toString() : ''),
        })
      } else {
        row = row.concat(createTableRow(config[key].properties, point[key]))
      }
    })
    return row
  }

  /**
   * render add/edit form for point
   * @param {Object} [point] data of editing point(optional).
   * @returns {Object} form JSX
   */
  const handleEdit = () => (
    <div>
      <Form />
      <Button
        color="primary"
      >
        Cancel
      </Button>
    </div>
  )

  // configure table header and rows
  const tableHeaders = []

  // paging
  const pagedPointsJson = filteredPoints.filter(
    (_, index) => index >= selectedPage * MAX_ON_PAGE - MAX_ON_PAGE && index < selectedPage * MAX_ON_PAGE,
  )
  const tableRows = pagedPointsJson.map((point, index) => createTableRow(point, index))

  return (
    <div>
      <FormGroup>
        <Label for="filter-text">Filter</Label>
        <Input
          className="oi-form-input"
          type="text"
          id="fromDatee"
          defaultValue={filterText}
          placeholder="Type any points related data"
          onChange={(event) => updateFilterText(event.target.value)}
        />
      </FormGroup>
      <Table
        headers={tableHeaders}
        rows={tableRows}
        handleAdd={handleAdd}
        handleDelete={handleDelete}
        handleEdit={handleEdit}
      />
      {filteredPoints.length ? (
        <TablePagination
          maxToDisplay={MAX_PAGINATION_DISPLAY}
          selected={selectedPage}
          total={Math.ceil(filteredPoints.length / MAX_ON_PAGE)}
          onPagePressed={(page) => setSelectedPage(page)}
        />
      ) : null}
      <div className="force-row-display">
        <Button className="inline-button" color="primary" onClick={() => document.getElementById('importFile').click()}>
          Import
        </Button>
        <Input
          className="oi-form-input"
          type="file"
          id="importFile"
          accept=".csv, text/plain"
          hidden
          onChange={(event) => handleImportPoints(event.target.files[0])}
        />
        <Button className="inline-button" color="primary" onClick={handleExportPoints}>
          Export
        </Button>
        <Modal show={false} title="Delete All Points" body="Are you sure you want to delete All Points from this Data Source?">
          {(confirm) => (
            <div>
              <Button className="inline-button" color="danger" onClick={confirm(() => handleDeleteAllPoint())}>
                Delete All Points
              </Button>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}

ConfigureProtocol.propTypes = { match: PropTypes.object.isRequired }

export default withRouter(ConfigureProtocol)
