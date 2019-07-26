import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Button, Input, FormGroup, Label } from 'reactstrap'
import Form from 'react-jsonschema-form-bs4'
import Table from '../client/components/table/Table.jsx'
import TablePagination from '../client/components/table/TablePagination.jsx'
import Modal from '../client/components/Modal.jsx'
import apis from '../client/services/apis'
import utils from '../client/helpers/utils'
import uiSchema from './uiSchema.jsx'
import { AlertContext } from '../client/context/AlertContext'

const ConfigureProtocol = ({ match, location }) => {
  const [pointsJson, setPointsJson] = React.useState([])
  const [configPoint, setConfigPoint] = React.useState([])
  const [configPointSchema, setConfigPointSchema] = React.useState({})
  const [engineJson, setEngineJson] = React.useState()
  const [editingPoint, setEditingPoint] = React.useState()
  const [addingPoint, setAddingPoint] = React.useState()
  const [filteredPointsJson, setFilteredPointsJson] = React.useState([])
  const [selectedPage, setSelectedPage] = React.useState(1)
  const [sortBy, setSortBy] = React.useState()
  const [filterText, setFilterText] = React.useState()
  const { setAlert } = React.useContext(AlertContext)
  // max points on one page
  const maxOnPage = 10
  // this value will be used to calculate the amount of max pagination displayed
  const maxPaginationDisplay = 11

  /**
   * Sets the points schema JSON
   * @param {Object} schema schema of the protocol
   * @returns {void}
   */
  const updateSchema = (schema) => {
    const { points } = schema.properties
    setConfigPoint(points.items.properties)
    setConfigPointSchema(points.items)
  }

  /**
   * Update the filtered points JSON
   * @param {Object} points points Json
   * @param {string} filter filter value
   * @returns {void}
   */
  const updateFilteredPointsJson = (points, filter) => {
    setFilteredPointsJson(
      filter
        ? points.filter((point) => (
          Object.values(point).findIndex((element) => (
            element.toString().toLowerCase().includes(filter.toLowerCase()))) >= 0))
        : points,
    )
  }

  /**
   * Sets the points JSON
   * @param {Object} points points Json
   * @returns {void}
   */
  const updatePointsJson = (points) => {
    setPointsJson(points)
    updateFilteredPointsJson(points, filterText)
  }

  /**
   * Sets the filter text
   * @param {string} value filter value
   * @returns {void}
   */
  const updateFilterText = (value) => {
    setSelectedPage(1)
    setFilterText(value)
    updateFilteredPointsJson(pointsJson, value)
  }

  /**
   * Acquire the engine JSON in case the configEngine is not passed
   * @returns {void}
   */
  const getEngine = () => {
    // eslint-disable-next-line consistent-return
    fetch('/config').then((response) => {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.indexOf('application/json') !== -1) {
        return response.json().then(({ config }) => {
          const { engine } = config
          setEngineJson(engine)
        })
      }
    })
  }

  /**
   * Acquire the list of points and schema for the protocol
   * @returns {void}
   */
  React.useEffect(() => {
    const { protocol, datasourceid } = match.params
    const { configEngine } = location
    if (configEngine) {
      setEngineJson(configEngine)
    } else {
      getEngine()
    }
    apis.getPoints(datasourceid).then((points) => {
      if (points.length) {
        updatePointsJson(points)
      }
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })

    apis.getSouthProtocolSchema(protocol).then((schema) => {
      updateSchema(schema)
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }, [])

  /**
   * Make modification based on engine config to the config points schema
   * @returns {object} config schema
   */
  const modifiedConfigSchema = () => {
    // check if all type configuration are already set
    if (pointsJson && engineJson && configPointSchema) {
      const { scanMode } = configPointSchema.properties
      const { scanModes } = engineJson
      // check if scanMode, scanModes exists and enum was not already set
      if (scanMode && scanMode.enum === undefined && scanModes) {
        scanMode.enum = scanModes.map((item) => item.scanMode)
      }
    }
    return configPointSchema
  }

  /**
   * Delete point
   * @param {string} pointId the id of point
   * @returns {void}
   */
  const handleDeletePoint = async (pointId) => {
    const { datasourceid } = match.params
    try {
      await apis.deletePoint(datasourceid, pointId)
      updatePointsJson(pointsJson.filter((point) => point.pointId !== pointId))
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  /**
   * Delete all points
   * @returns {void}
   */
  const handleDeleteAllPoint = async () => {
    const { datasourceid } = match.params
    try {
      await apis.deleteAllPoints(datasourceid)
      updatePointsJson([])
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  /**
   * Save edited point
   * @param {Object} point data of edited point
   * @returns {void}
   */
  const handleSubmitEditedPoint = async (point) => {
    const { datasourceid } = match.params
    try {
      await apis.updatePoint(datasourceid, editingPoint.pointId, point)
      const newPoints = pointsJson.map((oldPoint) => (
        oldPoint.pointId === editingPoint.pointId ? point : oldPoint
      ))
      updatePointsJson(newPoints)
      setEditingPoint()
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  /**
   * Save new point
   * @param {Object} point data of edited point
   * @returns {void}
   */
  const handleSubmitAddedPoint = async (point) => {
    const { datasourceid } = match.params
    try {
      await apis.addPoint(datasourceid, point)
      updatePointsJson([...pointsJson, point])
      setAddingPoint()
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
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
    try {
      await apis.importPoints(datasourceid, text).then((points) => {
        updatePointsJson(points)
      })
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
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
   * create the array with title for the table header
   * this function is recursive, it will work recursiveli once the schema has objects
   * @param {Object} config of the points from the protocol
   * @param {boolean} withBeginAddons add addons before actual data
   * @param {boolean} withEndAddons add addons after actual data
   * like: Index, action buttons etc.
   * @returns {Array} the titles for columns (headers)
   */
  const createTableHeader = (config, withBeginAddons = false, withEndAddons = false) => {
    const keys = Object.keys(config)
    let titles = withBeginAddons ? ['Index'] : []
    keys.forEach((key) => {
      if (config[key].type !== 'object') {
        titles.push(
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }} key={config[key].title}>
            <span style={{ marginRight: 5, whiteSpace: 'nowrap' }}>{config[key].title}</span>
            <Button className="inline-button" style={{ marginRight: 5 }} color="primary" onClick={() => setSortBy(key)}>
              ▲
            </Button>
            <Button className="inline-button" color="primary" onClick={() => setSortBy(`-${key}`)}>
              ▼
            </Button>
          </div>,
        )
      } else {
        // extract titles in case of object
        titles = titles.concat(createTableHeader(config[key].properties))
      }
    })
    titles = titles.concat(withEndAddons ? ['Actions'] : [])
    return titles
  }

  /**
   * create one cell with the value
   * @param {string} value the displayed value
   * @returns {void}
   */
  const createCell = (value) => (
    <div>
      {value}
    </div>
  )

  /**
   * create actions buttons
   * @param {object} point point data
   * @returns {void}
   */
  const createActions = (point) => (
    <Modal show={false} title="Delete Point" body="Are you sure you want to delete this Point?" acceptLabel="Delete" acceptColor="danger">
      {(confirm) => (
        <div className="force-row-display ">
          <Button className="inline-button" color="primary" onClick={() => setEditingPoint(point)}>
            Edit
          </Button>
          <Button className="inline-button" color="danger" onClick={confirm(() => handleDeletePoint(point.pointId))}>
            Delete
          </Button>
        </div>
      )}
    </Modal>
  )

  /**
   * create addons array, to be displayed on begining of each row
   * @param {number} index index of the row
   * @returns {array} array with name-value for the addons
   */
  const createBeginAddons = (index) => [
    {
      name: 'index',
      value: selectedPage * maxOnPage - maxOnPage + index + 1,
    },
  ]

  /**
   * create addons array, to be displayed on end of each row
   * @param {number} index index of the row
   * @returns {array} array with name-value for the addons
   */
  const createEndAddons = (index) => [
    {
      name: 'actions',
      value: createActions(filteredPointsJson[selectedPage * maxOnPage - maxOnPage + index]),
    },
  ]

  /**
   * create the array with cells on a particular row
   * this function is recursive, it will work recursiveli once the schema has objects
   * @param {Object} config of the points from the protocol
   * @param {Object} point data of one point
   * @param {number} index index of the row
   * @param {boolean} addBeginAddons flag to add begin row addons
   * @param {boolean} addEndAddons flag to add end row addons
   * @returns {Array} array with name-value for the cells
   */
  const createTableRow = (config, point, index = null, addBeginAddons = false, addEndAddons = false) => {
    const keys = Object.keys(config)
    let row = addBeginAddons ? createBeginAddons(index) : []
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
    if (addEndAddons) {
      row = row.concat(createEndAddons(index))
    }
    return row
  }

  /**
   * log form errors
   * @param {error} type error type
   * @returns {void}
   */
  const log = (type) => console.info.bind(console, type)

  /**
   * render add/edit form for point
   * @param {Object} [point] data of editing point(optional).
   * @returns {Object} form JSX
   */
  const renderAddEditForm = (point = {}) => (
    <div>
      <Form
        formData={point}
        liveValidate
        showErrorList={false}
        schema={modifiedConfigSchema()}
        uiSchema={uiSchema(match.params.protocol).points.items}
        autocomplete="on"
        onSubmit={({ formData }) => (
          editingPoint ? handleSubmitEditedPoint(formData) : handleSubmitAddedPoint(formData)
        )}
        onError={log('errors')}
      />
      <Button
        color="primary"
        onClick={() => {
          setEditingPoint()
          setAddingPoint()
        }}
      >
        Cancel
      </Button>
    </div>
  )

  /**
   * render table with points data
   * @param {Array} tableHeaders data of point
   * @param {Array} tableRows data of point
   * @returns {Object} table JSX
   */
  const renderTable = (tableHeaders, tableRows) => (
    <div>
      <FormGroup>
        <Label for="filter-text">Filter</Label>
        <Input
          type="text"
          id="fromDatee"
          defaultValue={filterText}
          placeholder="Type any points related data"
          onChange={(event) => updateFilterText(event.target.value)}
        />
      </FormGroup>
      <Table headers={tableHeaders} rows={tableRows} onRowClick={() => null} />
      {filteredPointsJson.length ? (
        <TablePagination
          maxToDisplay={maxPaginationDisplay}
          selected={selectedPage}
          total={Math.ceil(filteredPointsJson.length / maxOnPage)}
          onPagePressed={(page) => setSelectedPage(page)}
        />
      ) : null}
      <div className="force-row-display">
        <Button className="inline-button" color="primary" onClick={() => setAddingPoint({})}>
              Add
        </Button>
        <Button
          className="inline-button"
          color="primary"
          onClick={() => document.getElementById('importFile').click()}
        >
              Import
        </Button>
        <Input
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

  // configure table header and rows
  const tableHeaders = createTableHeader(configPoint, true, true)
  // sorting
  const sortedPointsJson = sortBy ? filteredPointsJson.sort(utils.dynamicSort(sortBy)) : filteredPointsJson
  // paging
  const pagedPointsJson = sortedPointsJson.filter((_, index) => (
    index >= selectedPage * maxOnPage - maxOnPage && index < selectedPage * maxOnPage
  ))
  const tableRows = pagedPointsJson.map((point, index) => createTableRow(configPoint, point, index, true, true))

  return (
    <>
      {editingPoint || addingPoint
        ? renderAddEditForm(editingPoint || addingPoint)
        : renderTable(tableHeaders, tableRows)
      }
    </>
  )
}

ConfigureProtocol.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}

export default withRouter(ConfigureProtocol)
