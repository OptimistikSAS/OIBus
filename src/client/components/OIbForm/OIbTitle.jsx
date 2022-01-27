import React from 'react'
import PropTypes from 'prop-types'
import { UncontrolledCollapse, Button, Row, Col, Container } from 'reactstrap'
import { FaRegQuestionCircle } from 'react-icons/fa'

const OIbTitle = ({ label, children }) => {
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
            <Button color="link" id={id} className="util-button mt-1">
              <FaRegQuestionCircle
                className="oi-help"
                size={12}
              />
            </Button>
          )}
        </h5>
      </Row>
      <Container fluid>
        {children && (
          <UncontrolledCollapse toggler={id}>
            <Row style={{ marginBottom: '15px' }}>
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
OIbTitle.propTypes = { children: PropTypes.element, label: PropTypes.string.isRequired }
OIbTitle.defaultProps = { children: null }

export default OIbTitle
