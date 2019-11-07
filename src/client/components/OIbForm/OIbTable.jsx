import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'

import OIbTitle from './OIbTitle.jsx'
import Table from '../table/Table.jsx'
import { ConfigContext } from '../../context/configContext.jsx'

const OIbTable = ({ name, label, help, headers, md }) => {
  const { dispatchNewConfig } = React.useContext(ConfigContext)
  const defaultValues = {}
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `${name}.${rowIndex}` })
  }
  const handleAdd = () => {
    const defaultValue = defaultValues
    dispatchNewConfig({ type: 'addRow', name: `${name}`, value: defaultValue })
  }
  const onChange = (valueName, value) => {
    dispatchNewConfig({ type: 'update', name: `${valueName}`, value })
  }
  const rows = []
  return (
    <>
      <OIbTitle label={label}>{help}</OIbTitle>
      <Row>
        <Col md={md}>
          <Table headers={headers} rows={rows} onChange={onChange} handleDelete={handleDelete} handleAdd={handleAdd} />
        </Col>
      </Row>
    </>
  )
}

OIbTable.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.string.isRequired,
  headers: PropTypes.string.isRequired,
  md: PropTypes.string.isRequired,
}

export default OIbTable
