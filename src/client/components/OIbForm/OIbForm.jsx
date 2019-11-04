import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'

const Controls = require('./index.js')

const OIbForm = ({ schema, onChange, values }) => {
  const { form } = schema
  /* transform into arrays of line with array of col */
  const rows = []
  let rowNum = -1
  Object.entries(form).forEach(([name, parameters]) => {
    const { newRow, ...rest } = parameters
    if (newRow || rowNum === 0) {
      rows.push([])
      rowNum += 1
    }
    rows[rowNum].push({ name, ...rest })
  })
  return rows.map((cols) => (
    <Row key={cols[0].name}>
      {cols.map((col) => {
        const { type, md, name, ...rest } = col
        const Control = Controls[type]
        return (
          <Col md={md} key={name}>
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <Control onChange={onChange} value={values[name]} name={`${schema.name}.${name}`} {...rest} />
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
}

export default OIbForm
