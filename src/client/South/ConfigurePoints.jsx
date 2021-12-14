import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, Spinner } from 'reactstrap'
import humanizeString from 'humanize-string'
import { FaArrowLeft } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import TablePagination from '../components/table/TablePagination.jsx'
import Modal from '../components/Modal.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/ConfigContext.jsx'
import ProtocolSchemas from './Protocols.jsx'
import * as Controls from '../components/OIbForm'
import utils from '../helpers/utils'
import validation from './Form/South.validation'
import StatusButton from '../StatusButton.jsx'

const ConfigurePoints = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const [filterText, setFilterText] = React.useState('') // used to limit the list of points
  const [selectedPage, setSelectedPage] = React.useState(1)
  const { setAlert } = React.useContext(AlertContext)
  const navigate = useNavigate()
  // max points on one page
  const MAX_ON_PAGE = 10
  // this value will be used to calculate the amount of max pagination displayed
  const MAX_PAGINATION_DISPLAY = 11
  const pageOffset = selectedPage * MAX_ON_PAGE - MAX_ON_PAGE

  const { id } = useParams()

  if (!newConfig?.south) {
    return (
      <div className="spinner-container">
        <Spinner color="primary" type="grow" />
        ...loading points from OIBus server...
      </div>
    )
  }
  const dataSourceIndex = newConfig.south.dataSources.findIndex(
    (dataSource) => dataSource.id === id,
  )
  const dataSource = newConfig.south.dataSources[dataSourceIndex]

  const { points: pointsOrdered = [], protocol } = dataSource
  // add virtualIndex for each point for helping the filter
  const points = pointsOrdered.slice().map((item, index) => ({ virtualIndex: index, ...item })).reverse()

  // filter
  const filteredPoints = filterText
    ? points.filter(
      (point) => {
        // remove the virtualIndex from filterable attributes
        const filterableAttributes = { ...point }
        delete filterableAttributes.virtualIndex
        return Object.values(filterableAttributes).findIndex((element) => element
          .toString()
          .toLowerCase()
          .includes(filterText.toLowerCase())) >= 0
      },
    ) : points

  /**
   * @param {number} index the index of a point in the table
   * @returns {number} the index in the config file of the chosen point
   */
  const findIndexBasedOnVirtualIndex = (index) => {
    const paginatedIndex = MAX_ON_PAGE * (selectedPage - 1) + index
    const pointToOperate = filteredPoints[paginatedIndex]
    const indexInTable = points.findIndex((point) => point.virtualIndex === pointToOperate.virtualIndex)
    // reverse the table index to get the index in the config file
    const totalIndex = points.length - 1
    const totalOnPage = totalIndex - (MAX_ON_PAGE * (selectedPage - 1))
    return totalOnPage - indexInTable
  }

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
    setSelectedPage(1) // jump to first page, to see new row
    dispatchNewConfig({ type: 'addRow', name: `south.dataSources.${dataSourceIndex}.points`, value: {} })
  }

  /**
   * Delete point
   * @param {string} index the index of point
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.dataSources.${dataSourceIndex}.points.${findIndexBasedOnVirtualIndex(index)}` })
  }

  /**
   * Delete all points
   * @returns {void}
   */
  const handleDeleteAllPoint = () => {
    dispatchNewConfig({ type: 'deleteAllRows', name: `south.dataSources.${dataSourceIndex}.points` })
  }

  /**
   * Send the imported file content to the backend
   * @param {Object} file the file returned by input
   * @returns {void}
   */
  const handleImportPoints = async (file) => {
    try {
      const text = await utils.readFileContent(file)
      utils
        .parseCSV(text)
        .then((newPoints) => {
          dispatchNewConfig({
            type: 'importPoints',
            name: `south.dataSources.${dataSourceIndex}.points`,
            value: newPoints,
          })
        })
        .catch((error) => {
          console.error(error)
          setAlert({ text: error.message, type: 'danger' })
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
    const csvString = utils.createCSV(pointsOrdered)
    const element = document.createElement('a')
    const file = new Blob([csvString], { type: 'text/csv' })
    element.href = URL.createObjectURL(file)
    element.download = `${dataSource.name}.csv`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const onChange = (name, value, validity) => {
    // add pageOffset before dispatch the update to update the correct point (pagination)
    const index = Number(name.match(/[0-9]+/g))
    const pathWithPageOffset = name.replace(/[0-9]+/g, `${findIndexBasedOnVirtualIndex(index)}`)
    dispatchNewConfig({
      type: 'update',
      name: `south.dataSources.${dataSourceIndex}.${pathWithPageOffset}`,
      value,
      validity,
    })
  }

  const ProtocolSchema = ProtocolSchemas[protocol]
  // configure help if exists
  const pointsWithHelp = Object.entries(ProtocolSchema.points).filter(([name, value]) => name && value.help)
  const tableHelps = pointsWithHelp.length > 0 && pointsWithHelp.map(([name, value]) => (
    <div key={name}>
      <b>{`${value.label || humanizeString(name)}: `}</b>
      {value.help}
    </div>
  ))
  // configure table header and rows
  const tableHeaders = Object.entries(ProtocolSchema.points).map(([name, value]) => value.label || humanizeString(name))

  // paging
  const pagedPoints = filteredPoints.filter((_, index) => index >= pageOffset && index < selectedPage * MAX_ON_PAGE)

  const tableRows = pagedPoints.map((point, index) => Object.entries(ProtocolSchema.points).map(([key, value]) => {
    const { type, ...rest } = value
    const Control = Controls[type]
    rest.value = point[key]
    rest.label = null // remove field title in table rows
    rest.help = null // remove help in table rows
    // check if must be unique and extend already existing validation with isUnique check
    if (ProtocolSchema.points[key].unique) {
      const indexOffset = (selectedPage - 1) * MAX_ON_PAGE
      const pointIds = points.filter((_point) => _point.virtualIndex !== filteredPoints[indexOffset + index].virtualIndex).map((p) => p[key])
      const oldValid = rest.valid.bind({})
      rest.valid = (val) => {
        const result = oldValid(val) || validation.points.isUnique(val, pointIds) || validation.points.noUnintendedTrailingSpaces(val)
        return result
      }
    }
    const name = `points.${index}.${key}`
    return (
      /* eslint-disable-next-line react/jsx-props-no-spreading */
      { name, value: <Control onChange={onChange} name={name} {...rest} /> }
    )
  }))

  return (
    <>
      <div className="d-flex align-items-center w-100 oi-sub-nav mb-2">
        <h6 className="text-muted d-flex align-items-center pl-3 pt-1">
          <Button
            close
            onClick={() => {
              navigate(-1)
            }}
          >
            <FaArrowLeft className="oi-icon mr-2" />
          </Button>
          {`| ${dataSource.name}`}
        </h6>
        <div className="pull-right mr-3">
          <StatusButton
            handler={() => {
              navigate(`/south/${id}/live`)
            }}
            enabled={dataSource.enabled}
          />
        </div>
      </div>
      <div className="points">
        <div>
          <Controls.OIbText
            label="Filter"
            name="filterText"
            value={filterText}
            help={<div>Type any points related data</div>}
            onChange={(_name, val) => updateFilterText(val)}
          />
        </div>
        <Table help={tableHelps} headers={tableHeaders} rows={tableRows} handleAdd={handleAdd} handleDelete={handleDelete} />
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
      </div>
    </>
  )
}

export default ConfigurePoints
