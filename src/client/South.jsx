import React from 'react'
import PropTypes from 'prop-types'

// import { } from 'reactstrap'

const South = ({ configJson }) => (
  <>
    <h1>South</h1>
    <pre>{JSON.stringify(configJson.south, ' ', 2)}</pre>
  </>
)
export default South

South.propTypes = { configJson: PropTypes.object.isRequired }
