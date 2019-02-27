import React from 'react'
import PropTypes from 'prop-types'

// import { } from 'reactstrap'

const Engine = ({ configJson }) => (
  <>
    <h1>Engine</h1>
    <pre>{JSON.stringify(configJson.engine, ' ', 2)}</pre>
  </>
)
export default Engine

Engine.propTypes = { configJson: PropTypes.object.isRequired }
