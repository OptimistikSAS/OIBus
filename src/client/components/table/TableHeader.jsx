import React from 'react'
import PropTypes from 'prop-types'
import { FaPlusCircle, FaLongArrowAltDown, FaLongArrowAltUp } from 'react-icons/fa'

const TableHeader = ({ headers, sortableProperties, sortBy, isAscending, handleAdd, handleDelete, handleSort, handleOrder }) => {
  let decoratedHeaders = headers
  if (handleAdd) {
    decoratedHeaders[0] = ( // add Icon in the header
      <>
        <FaPlusCircle className="oi-icon" onClick={handleAdd} />
        <span>{headers[0]}</span>
      </>
    )
  }
  if (handleDelete) {
    decoratedHeaders.push('') // add column for the delete icon
    // headers.push('actions') // used for the unique key
  }

  if (handleOrder) {
    decoratedHeaders = [''].concat(decoratedHeaders)
  }

  const renderSorting = (index) => {
    const property = sortableProperties[index]
    const isSelectedAscending = property === sortBy && isAscending
    const isSelectedDescending = property === sortBy && !isAscending
    return (
      <>
        <FaLongArrowAltDown
          className="oi-up-down"
          onClick={() => handleSort(sortableProperties[index], true)}
          style={{ opacity: isSelectedAscending ? 1.0 : 0.5, width: 6, marginLeft: 2 }}
        />
        <FaLongArrowAltUp
          className="oi-up-down"
          onClick={() => handleSort(sortableProperties[index], false)}
          style={{ opacity: isSelectedDescending ? 1.0 : 0.5, width: 6 }}
        />
      </>
    )
  }
  return (
    <thead>
      <tr>
        {decoratedHeaders.map((decoratedHeader, index) => (
          sortableProperties && sortableProperties.length > index ? (
            <th key={headers[index]} scope="col">
              {decoratedHeader}
              {renderSorting(index)}
            </th>
          ) : (
            <th key={headers[index]} scope="col">
              {decoratedHeader}
            </th>
          )
        ))}
      </tr>
    </thead>
  )
}

TableHeader.propTypes = {
  headers: PropTypes.PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])).isRequired,
  sortableProperties: PropTypes.arrayOf(PropTypes.string),
  sortBy: PropTypes.string,
  isAscending: PropTypes.bool,
  handleAdd: PropTypes.func,
  handleDelete: PropTypes.func,
  handleSort: PropTypes.func,
  handleOrder: PropTypes.func,
}
TableHeader.defaultProps = {
  sortableProperties: null,
  sortBy: null,
  isAscending: null,
  handleAdd: null,
  handleDelete: null,
  handleSort: null,
  handleOrder: null,
}

export default TableHeader
