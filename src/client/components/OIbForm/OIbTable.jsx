import React from 'react'
import PropTypes from 'prop-types'

import Table from '../table/Table.jsx'
import { ConfigContext } from '../../context/configContext.jsx'
import * as Controls from './index.js'

const OIbTable = ({ name, label, help, rows, value }) => {
  const { dispatchNewConfig } = React.useContext(ConfigContext)
  const defaultValues = {}
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `${name}.${rowIndex}` })
  }
  const handleAdd = () => {
    const defaultValue = defaultValues
    dispatchNewConfig({ type: 'addRow', name: `${name}`, value: defaultValue })
  }
  const onChange = (valueName, newVal) => {
    dispatchNewConfig({ type: 'update', name: `${valueName}`, newVal })
  }
  const tableHeaders = Object.values(rows).map((row) => row.label)
  const tableRows = value.map((point, index) => Object.entries(rows).map(([rowKey, rowValue]) => {
    const { type, ...rest } = rowValue
    const Control = Controls[type]
    rest.value = point[rowKey]
    rest.label = null // remove field title in table rows
    return (
      /* eslint-disable-next-line react/jsx-props-no-spreading */
      { name, value: <Control onChange={onChange} name={`${name}.${index}.${rowKey}`} {...rest} /> }
    )
  }))
  return (
    <>
      <Controls.OIbTitle label={label}>{help}</Controls.OIbTitle>
      <Table headers={tableHeaders} rows={tableRows} onChange={onChange} handleDelete={handleDelete} handleAdd={handleAdd} />
    </>
  )
}

OIbTable.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.element.isRequired,
  rows: PropTypes.object.isRequired,
  value: PropTypes.arrayOf(Object),
}

OIbTable.defaultProps = { value: [] }

export default OIbTable
