import React, { useEffect } from 'react'
import { Button, Input } from 'reactstrap'

import PropTypes from 'prop-types'
import { nanoid } from 'nanoid'
import Table from './table/table.jsx'
import TablePagination from './table/table-pagination.jsx'
import Modal from './modal.jsx'
import * as Controls from './oib-form/index.js'
import utils from '../helpers/utils.js'

// Max points on one page
const MAX_ON_PAGE = 10
// This value will be used to calculate the amount of max pagination displayed
const MAX_PAGINATION_DISPLAY = 11

const PointsComponent = ({
  prefix,
  schema,
  points,
  onChange,
}) => {
  const [filterText, setFilterText] = React.useState('') // used to limit the list of points
  const [selectedPage, setSelectedPage] = React.useState(1)
  const [allPoints, setAllPoints] = React.useState(points)
  const [filteredPoints, setFilteredPoints] = React.useState(points)
  const [tableRows, setTableRows] = React.useState([])

  // configure help if exists
  const pointsWithHelp = Object.entries(schema.points).filter(([name, value]) => name && value.help)
  const tableHelps = pointsWithHelp.length > 0 && pointsWithHelp.map(([name, value]) => (
    <div key={name}>
      <b>{`${value.label || name}: `}</b>
      {value.help}
    </div>
  ))
  // configure table header and rows
  const tableHeaders = Object.entries(schema.points).map(([_name, value]) => value.label || _name)

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
   * Add a point to the list
   * @returns {void}
   */
  const handleAddPoint = () => {
    const newPoint = { id: nanoid() }
    Object.entries(schema.points).forEach(([key, value]) => {
      newPoint[key] = value.defaultValue
    })
    const newAllPoints = [...allPoints]
    newAllPoints.unshift(newPoint)
    setAllPoints(newAllPoints)
    setSelectedPage(1) // jump to first page, to see new row
    onChange(prefix, newAllPoints)
  }

  const handleChange = (idAndName, value) => {
    const [id, name] = idAndName.split('.')
    const newAllPoints = [...allPoints]
    const pointToUpdate = newAllPoints.find((point) => point.id === id)
    pointToUpdate[name] = value
    setAllPoints(newAllPoints)
    onChange(prefix, newAllPoints)
  }

  /**
   * Delete point by its ID
   * @param {string} id the ID of point
   * @returns {void}
   */
  const handleDeletePoint = (id) => {
    const newAllPoints = allPoints.filter((point) => point.id !== id)
    setAllPoints(newAllPoints)
    onChange(prefix, newAllPoints)
  }

  /**
   * Download export file of points
   * @returns {void}
   */
  const handleExportPoints = () => {
    const csvString = utils.createCSV(allPoints.map((point) => {
      delete point.id
      return point
    }))
    const element = document.createElement('a')
    const file = new Blob([csvString], { type: 'text/csv' })
    element.href = URL.createObjectURL(file)
    element.download = 'points.csv'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  /**
   * Send the imported file content to the backend
   * @param {Object} file the file returned by input
   * @returns {void}
   */
  const handleImportPoints = async (file) => {
    try {
      const text = await utils.readFileContent(file)
      const newAllPoints = await utils.parseCSV(text)
      setAllPoints(newAllPoints.map((point) => ({ ...point, id: nanoid() })))
      onChange(prefix, newAllPoints)
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteAllPoints = () => {
    setAllPoints([])
    onChange(prefix, [])
  }

  useEffect(() => {
    const pageOffset = selectedPage * MAX_ON_PAGE - MAX_ON_PAGE
    const newFilteredPoints = filterText !== '' ? allPoints.filter((point) => Object.values(point).findIndex((element) => element
      .toString()
      .toLowerCase()
      .includes(filterText.toLowerCase())) >= 0) : allPoints

    const newTableRows = newFilteredPoints.filter((_, index) => index >= pageOffset && index < selectedPage * MAX_ON_PAGE)
      .map((point) => Object.entries(schema.points).map(([key, value]) => {
        const { type, ...rest } = value
        const Control = Controls[type]
        rest.value = point[key]
        rest.label = null // remove field title in table rows
        rest.help = null // remove help in table rows
        return (
          // id is used to remove the point from its id with handle delete
          /* eslint-disable-next-line react/jsx-props-no-spreading */
          { id: point.id, name: `${point.id}.${key}`, value: <Control onChange={handleChange} name={`${point.id}.${key}`} {...rest} /> }
        )
      }))

    setFilteredPoints(newFilteredPoints)
    setTableRows(newTableRows)
  }, [filterText, selectedPage, allPoints])

  return (
    <div className="m-2">
      <Controls.OibTitle label="Points" />
      <Controls.OibText
        label="Filter"
        name="filterText"
        value={filterText}
        help={<div>Type any points related data</div>}
        onChange={(_name, val) => updateFilterText(val)}
      />
      <Table help={tableHelps || []} headers={tableHeaders} rows={tableRows} handleAdd={handleAddPoint} handleDelete={handleDeletePoint} />
      {filteredPoints.length > 0 && (
        <TablePagination
          maxToDisplay={MAX_PAGINATION_DISPLAY}
          selected={selectedPage}
          total={Math.ceil(filteredPoints.length / MAX_ON_PAGE)}
          onPagePressed={(page) => setSelectedPage(page)}
        />
      )}
      <div className="force-row-display mt-3">
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
          body="Are you sure you want to delete all points from this connector?"
        >
          {(confirm) => (
            <div>
              <Button className="inline-button" color="danger" onClick={confirm(() => handleDeleteAllPoints())}>
                Delete All Points
              </Button>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}

PointsComponent.propTypes = {
  points: PropTypes.arrayOf(PropTypes.object).isRequired,
  prefix: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  schema: PropTypes.object.isRequired,
}

export default PointsComponent
