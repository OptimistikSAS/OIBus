import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import { Link } from 'react-router-dom'
import { OIbTitle, OIbCheckBox, OIbText } from '../../components/OIbForm'
import OIbDate from '../../components/OIbForm/OIbDate.jsx'

const BulkForm = ({ bulk, onChange }) => {
  const { name } = bulk

  return (
    <Form>
      <Row>
        <Breadcrumb tag="h5">
          <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
            Home
          </BreadcrumbItem>
          <BreadcrumbItem tag={Link} to="/bulk" className="oi-breadcrumb">
            Bulk
          </BreadcrumbItem>
          <BreadcrumbItem active tag="span">
            {name}
          </BreadcrumbItem>
        </Breadcrumb>
      </Row>
      <OIbTitle label="General settings" />
      <Row>
        <Col md={1}>
          <OIbCheckBox
            name="d"
            label="Enabled"
            defaultValue={false}
            value={bulk.enabled}
            help={<div>Enable this bulk</div>}
            onChange={onChange}
            switchButton
          />
        </Col>
        <Col md={1}>
          <a href={`/south/${bulk.southId}`}><h6>South handler</h6></a>
        </Col>
        <Col md={1}>
          <a href={`/north/${bulk.northId}`}><h6>North handler</h6></a>
        </Col>
      </Row>
      <Row>
        <Col md={2}>
          <OIbDate
            name="startTime"
            value={bulk.startTime}
            label="From date"
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbDate
            name="endTime"
            value={bulk.endTime}
            label="To date"
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbText
            label="File pattern"
            name="filePattern"
            value={bulk.filePattern}
            defaultValue="./cache"
            onChange={onChange}
          />
        </Col>
        <Col md={2}>
          <OIbCheckBox
            name="compress"
            label="Compress"
            defaultValue={false}
            value={bulk.compress}
            onChange={onChange}
          />
        </Col>
      </Row>
      <Row>
        <Col md={4}>
          <p><strong>Current request: </strong></p>
        </Col>
      </Row>
      <Row>
        <Col md={4}>
          <p><strong>Last completed date: </strong></p>
        </Col>
      </Row>
    </Form>
  )
}

BulkForm.propTypes = {
  bulk: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default BulkForm
