import React from 'react'
import { useParams } from 'react-router-dom'
import { Button, Input, Spinner } from 'reactstrap'
import humanizeString from 'humanize-string'

import Table from '../components/table/Table.jsx'
import TablePagination from '../components/table/TablePagination.jsx'
import Modal from '../components/Modal.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import ProtocolSchemas from './Protocols.jsx'
import * as Controls from '../components/OIbForm'
import utils from '../helpers/utils'


const ConfigurePoints = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const [filterText, setFilterText] = React.useState('') // used to limit the list of points
  const [selectedPage, setSelectedPage] = React.useState(1)
  const { setAlert } = React.useContext(AlertContext)
  // max points on one page
  const MAX_ON_PAGE = 10
  // this value will be used to calculate the amount of max pagination displayed
  const MAX_PAGINATION_DISPLAY = 11
  const pageOffset = selectedPage * MAX_ON_PAGE - MAX_ON_PAGE

  const { dataSourceId } = useParams()
  if (!newConfig?.south) {
    return (
      <div className="spinner-container">
        <Spinner color="primary" type="grow" />
        ...loading points from OIBus server...
      </div>
    )
  }
  const dataSourceIndex = newConfig.south.dataSources.findIndex(
    (dataSource) => dataSource.dataSourceId === dataSourceId,
  )

  /**
   * Sets the filter text
   * @param {string} value filter value
   * @returns {void}
   */
  const updateFilterText = (value) => {
    setSelectedPage(1)
    setFilterText(value)
  }

  /**
   * add point
   * @returns {void}
   */
  const handleAdd = () => {
    dispatchNewConfig({ type: 'addRow', name: `south.dataSources.${dataSourceIndex}.points`, value: {} })
  }

  /**
   * Delete point
   * @param {string} index the index of point
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.dataSources.${dataSourceIndex}.points.${index}` })
  }

  /**
   * Delete all points
   * @returns {void}
   */
  const handleDeleteAllPoint = () => {
    dispatchNewConfig({ type: 'deleteAllRows', name: `south.dataSources.${dataSourceIndex}.points` })
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
    utils.parseCSV(text)
      .then((points) => {
        dispatchNewConfig({
          type: 'importPoints',
          name: `south.dataSources.${dataSourceIndex}.points`,
          value: points,
        })
      })
      .catch((error) => {
        console.error(error)
        setAlert({ text: error.message, type: 'danger' })
      })
  }

  /**
   * Download export file of points
   * @returns {void}
   */
  const handleExportPoints = () => {
    apis.exportAllPoints(dataSourceId).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }

  const onChange = (name, value, validity) => {
    // add pageOffet before dispatch the update to update the correct point (pagination)
    const index = Number(name.match(/[0-9]+/g))
    const pathWithPageOffset = name.replace(/[0-9]+/g, `${index + pageOffset}`)
    dispatchNewConfig({
      type: 'update',
      name: `south.dataSources.${dataSourceIndex}.${pathWithPageOffset}`,
      value,
      validity,
    })
  }
  /**
   * Gets the config json of a south dataSource
   * @param {string} id ID of an dataSource
   * @returns {object} The selected dataSource's config
   */
  const { points = [], protocol } = newConfig.south.dataSources[dataSourceIndex]
  const ProtocolSchema = ProtocolSchemas[protocol]
  // configure table header and rows
  const tableHeaders = Object.entries(ProtocolSchema.points).map(([name, value]) => value.label || humanizeString(name))
  // filter
  const filteredPoints = filterText
    ? points.filter(
      (point) => Object.values(point).findIndex((element) => element
        .toString()
        .toLowerCase()
        .includes(filterText.toLowerCase())) >= 0,
    ) : points

  // paging
  const pagedPoints = filteredPoints.filter((_, index) => index >= pageOffset && index < selectedPage * MAX_ON_PAGE)

  const tableRows = pagedPoints.map((point, index) => Object.entries(ProtocolSchema.points).map(([key, value]) => {
    const { type, ...rest } = value
    const Control = Controls[type]
    rest.value = point[key]
    rest.label = null // remove field title in table rows
    const name = `points.${index}.${key}`
    return (
      /* eslint-disable-next-line react/jsx-props-no-spreading */
      { name, value: <Control onChange={onChange} name={name} {...rest} /> }
    )
  }))

  return (
    <>
      <Controls.OIbText
        label="Filter"
        name="filterText"
        value={filterText}
        help={<div>Type any points related data</div>}
        onChange={(_name, val) => updateFilterText(val)}
      />
      <Table headers={tableHeaders} rows={tableRows} handleAdd={handleAdd} handleDelete={handleDelete} />
      {filteredPoints.length && (
        <TablePagination
          maxToDisplay={MAX_PAGINATION_DISPLAY}
          selected={selectedPage}
          total={Math.ceil(filteredPoints.length / MAX_ON_PAGE)}
          onPagePressed={(page) => setSelectedPage(page)}
        />
      )}
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
        <Modal
          show={false}
          title="Delete All Points"
          body="Are you sure you want to delete All Points from this Data Source?"
        >
          {(confirm) => (
            <div>
              <Button className="inline-button" color="danger" onClick={confirm(() => handleDeleteAllPoint())}>
                Delete All Points
              </Button>
            </div>
          )}
        </Modal>
      </div>
    </>
  )
}

export default ConfigurePoints
