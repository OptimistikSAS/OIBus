import React from 'react'
import { Button, Input } from 'reactstrap'
import humanizeString from 'humanize-string'

import PropTypes from 'prop-types'
import Table from './table/Table.jsx'
import TablePagination from './table/TablePagination.jsx'
import Modal from './Modal.jsx'
import * as Controls from './OIbForm'
import utils from '../helpers/utils'
import validation from '../South/Form/South.validation'

const PointsComponent = ({
  southId,
  points: pointsOrdered,
  handleDeleteAllPoint,
  handleAdd,
  handleDelete,
  handleImportPoints,
  onUpdate,
  pointsSchema,
}) => {
  const [filterText, setFilterText] = React.useState('') // used to limit the list of points
  const [selectedPage, setSelectedPage] = React.useState(1)
  // max points on one page
  const MAX_ON_PAGE = 10
  // this value will be used to calculate the amount of max pagination displayed
  const MAX_PAGINATION_DISPLAY = 11
  const pageOffset = selectedPage * MAX_ON_PAGE - MAX_ON_PAGE

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
    return pointsOrdered.findIndex((point) => point.pointId === pointToOperate.pointId)
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
  const handleAddPoint = () => {
    setSelectedPage(1) // jump to first page, to see new row
    handleAdd(Object.entries(pointsSchema).map(([name]) => name))
  }

  /**
   * Delete point
   * @param {number} index the index of point
   * @returns {void}
   */
  const handleDeletePoint = (index) => {
    const indexInConfig = findIndexBasedOnVirtualIndex(index)
    handleDelete(indexInConfig)
  }

  const onChange = (name, value, validity) => {
    // add pageOffset before dispatch the update to update the correct point (pagination)
    const index = Number(name.match(/[0-9]+/g))
    const pathWithPageOffset = name.replace(/[0-9]+/g, `${findIndexBasedOnVirtualIndex(index)}`)
    onUpdate(pathWithPageOffset, value, validity)
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
    element.download = 'points.csv'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  // configure help if exists
  const pointsWithHelp = Object.entries(pointsSchema).filter(([name, value]) => name && value.help)
  const tableHelps = pointsWithHelp.length > 0 && pointsWithHelp.map(([name, value]) => (
    <div key={name}>
      <b>{`${value.label || humanizeString(name)}: `}</b>
      {value.help}
    </div>
  ))
  // configure table header and rows
  const tableHeaders = Object.entries(pointsSchema).map(([name, value]) => value.label || humanizeString(name))

  // paging
  const pagedPoints = filteredPoints.filter((_, index) => index >= pageOffset && index < selectedPage * MAX_ON_PAGE)
  const tableRows = pagedPoints.map((point, index) => Object.entries(pointsSchema).map(([key, value]) => {
    const { type, ...rest } = value
    const Control = Controls[type]
    rest.value = point[key]
    rest.label = null // remove field title in table rows
    rest.help = null // remove help in table rows
    // check if must be unique and extend already existing validation with isUnique check
    if (pointsSchema[key].unique) {
      const indexOffset = (selectedPage - 1) * MAX_ON_PAGE
      const pointIds = points.filter((_point) => _point.virtualIndex !== filteredPoints[indexOffset + index].virtualIndex).map((p) => p[key])
      const oldValid = rest.valid.bind({})
      rest.valid = (val) => oldValid(val) || validation.points.isUnique(val, pointIds) || validation.points.noUnintendedTrailingSpaces(val)
    }
    const name = `points.${index}.${key}`
    return (
      /* eslint-disable-next-line react/jsx-props-no-spreading */
      { name, value: <Control onChange={onChange} name={name} {...rest} southId={southId} /> }
    )
  }))

  return (
    <div className="m-2">
      <Controls.OIbTitle label="Points" />
      <Controls.OIbText
        label="Filter"
        name="filterText"
        value={filterText}
        help={<div>Type any points related data</div>}
        onChange={(_name, val) => updateFilterText(val)}
      />
      <Table help={tableHelps || []} headers={tableHeaders} rows={tableRows} handleAdd={handleAddPoint} handleDelete={handleDeletePoint} />
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
  )
}

PointsComponent.propTypes = {
  southId: PropTypes.string.isRequired,
  points: PropTypes.arrayOf(PropTypes.object).isRequired,
  handleDeleteAllPoint: PropTypes.func.isRequired,
  handleAdd: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
  handleImportPoints: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  pointsSchema: PropTypes.arrayOf(PropTypes.object),
}
PointsComponent.defaultProps = { pointsSchema: [] }

export default PointsComponent
