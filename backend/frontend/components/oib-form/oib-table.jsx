import React from 'react'
import PropTypes from 'prop-types'

import Table from '../table/table.jsx'
import { ConfigContext } from '../../context/config-context.jsx'
import * as Controls from './index.js'

const OibTable = ({ name, rows, value }) => {
  const { dispatchNewConfig } = React.useContext(ConfigContext)
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `${name}.${rowIndex}` })
  }
  const handleAdd = () => {
    const defaultValue = {}
    Object.keys(rows).forEach((rowKey) => { defaultValue[rowKey] = rows[rowKey].defaultValue })
    dispatchNewConfig({ type: 'addRow', name, value: defaultValue })
  }
  const onChange = (valueName, newVal, validity) => {
    dispatchNewConfig({ type: 'update', name: `${valueName}`, value: newVal, validity })
  }
  const tableHeaders = Object.entries(rows).map(([rowKey, row]) => row.label || rowKey)
  const tableRows = value.map((point, index) => Object.entries(rows).map(([rowKey, rowValue]) => {
    const { type, ...rest } = rowValue
    const Control = Controls[type]
    rest.value = point[rowKey]
    rest.label = null // remove field title in table rows
    return (
      /* eslint-disable-next-line react/jsx-props-no-spreading */
      { name: `${name}.${index}.${rowKey}`, value: <Control onChange={onChange} name={`${name}.${index}.${rowKey}`} {...rest} /> }
    )
  }))
  return (
    <Table headers={tableHeaders} rows={tableRows} onChange={onChange} handleDelete={handleDelete} handleAdd={handleAdd} />
  )
}

OibTable.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.element,
  rows: PropTypes.object.isRequired,
  value: PropTypes.arrayOf(Object),
}

OibTable.defaultProps = { value: [], help: null }

export default OibTable
