import React from 'react'
import PropTypes from 'prop-types'
import { UncontrolledCollapse, Button, Row } from 'reactstrap'

const Help = ({ title, children }) => {
  const id = `id${Math.random()
    .toString(36)
    .substr(2, 9)}` // generate a unique id
  return (
    <>
      <Row>
        <h5>
          {title}
          {children && (
            // remove spaces so it can used as an Id
            <Button size="sm" color="link" id={id}>
              Help
            </Button>
          )}
        </h5>
      </Row>
      {children && (
        <UncontrolledCollapse toggler={id}>
          <Row className="oi-help">{children}</Row>
        </UncontrolledCollapse>
      )}
    </>
  )
}
Help.propTypes = { children: PropTypes.element, title: PropTypes.string.isRequired }
Help.defaultProps = { children: null }

export default Help
