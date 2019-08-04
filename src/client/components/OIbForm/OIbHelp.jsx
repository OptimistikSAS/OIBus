import React from 'react'
import PropTypes from 'prop-types'
import { UncontrolledCollapse, Button, Row } from 'reactstrap'

const Help = ({ children }) => (
  <Row>
    <Button color="link" id="toggler" size="sm">
      Help
    </Button>
    <UncontrolledCollapse toggler="#toggler">
      <div className="oi-help">{children}</div>
    </UncontrolledCollapse>
  </Row>
)
Help.propTypes = { children: PropTypes.element.isRequired }

export default Help
