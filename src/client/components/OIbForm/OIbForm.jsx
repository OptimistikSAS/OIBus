import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'

const Controls = require('./index.js')

const OIbForm = ({ def, onChange, values }) => {
  const { form } = def
  /* transform into arrays of line with array of col */
  const rows = [[]]
  let rowNum = 0
  Object.entries(form).forEach(([name, parameters]) => {
    const { newRow, ...rest } = parameters
    if (rowNum !== 0 && newRow) {
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
            <Control onChange={onChange} value={values[name]} name={name} {...rest} />
          </Col>
        )
      })}
    </Row>
  ))
}

OIbForm.propTypes = {
  def: PropTypes.object.isRequired,
  values: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default OIbForm
