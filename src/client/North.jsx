import React from 'react'
import PropTypes from 'prop-types'

// import { } from 'reactstrap'

const North = ({ configJson }) => (
  <>
    <h1>North</h1>
    <pre>{JSON.stringify(configJson.north, ' ', 2)}</pre>
  </>
)
export default North

North.propTypes = { configJson: PropTypes.object.isRequired }
