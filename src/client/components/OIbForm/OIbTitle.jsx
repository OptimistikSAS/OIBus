import React from 'react'
import PropTypes from 'prop-types'
import { UncontrolledCollapse, Button, Row, Col, Container } from 'reactstrap'
import { FaRegQuestionCircle } from 'react-icons/fa'

const Help = ({ label, children }) => {
  const id = `id${Math.random()
    .toString(36)
    .substr(2, 9)}` // generate a unique id
  return (
    <>
      <Row>
        <h5>
          {label}
          {children && (
            // remove spaces so it can used as an Id
            <Button close color="link" id={id}>
              <FaRegQuestionCircle
                className="oi-help"
              />
            </Button>
          )}
        </h5>
      </Row>
      <Container fluid>
        {children && (
          <UncontrolledCollapse toggler={id}>
            <Row>
              <Col>
                {children}
              </Col>
            </Row>
          </UncontrolledCollapse>
        )}
      </Container>
    </>
  )
}
Help.propTypes = { children: PropTypes.element, label: PropTypes.string.isRequired }
Help.defaultProps = { children: null }

export default Help
