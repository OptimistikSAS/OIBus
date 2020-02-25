import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import humanizeString from 'humanize-string'

import * as Controls from './index'
import OIbTable from './OIbTable.jsx'

const OIbForm = ({ schema, onChange, values, name: configName }) => {
  const { form } = schema
  /* transform into arrays of line with array of col */
  const rows = []
  let rowNum = -1
  Object.entries(form).forEach(([controlName, parameters]) => {
    const { newRow = true, ...rest } = parameters
    if (newRow || rowNum === 0) {
      rows.push([])
      rowNum += 1
    }
    if (!rest.label) rest.label = humanizeString(controlName)
    rows[rowNum].push({ name: controlName, ...rest })
  })
  return rows.map((cols) => (
    <Row key={cols[0].name}>
      {cols.map((col) => {
        const { type, name, ...rest } = col
        if (!rest.md) rest.md = (['OIbTitle', 'OIbAuthentication'].includes(type)) ? 12 : 4
        const Control = (type === 'OIbTable') ? OIbTable : Controls[type]
        rest.value = values[name]
        return (
          <Col md={rest.md} key={name}>
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <Control onChange={onChange} name={`${configName}.${name}`} {...rest} />
          </Col>
        )
      })}
    </Row>
  ))
}

OIbForm.propTypes = {
  schema: PropTypes.object.isRequired,
  values: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
}

export default OIbForm
