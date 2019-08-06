import React from 'react'
import PropTypes from 'prop-types'
import { UncontrolledCollapse, Button, Row } from 'reactstrap'

const Help = ({ title, children }) => (
  <>
    <Row>
      <h3>
        {title}
        {children && (
          // remove spaces so it can used as an Id
          <Button size="sm" color="link" id={title.replace(/ /g, '')}>
            Help
          </Button>
        )}
      </h3>
    </Row>
    {children && (
      <UncontrolledCollapse toggler={title.replace(/ /g, '')}>
        <Row className="oi-help">{children}</Row>
      </UncontrolledCollapse>
    )}
  </>
)
Help.propTypes = { children: PropTypes.element, title: PropTypes.string.isRequired }
Help.defaultProps = { children: null }

export default Help
