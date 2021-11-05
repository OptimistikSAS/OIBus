import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col, Breadcrumb, BreadcrumbItem, Label } from 'reactstrap'
import { Link } from 'react-router-dom'
import { FaPauseCircle, FaPlayCircle } from 'react-icons/fa'
import { OIbTitle, OIbCheckBox, OIbText, OIbTextArea } from '../../components/OIbForm'
import OIbDate from '../../components/OIbForm/OIbDate.jsx'
import { ConfigContext } from '../../context/configContext.jsx'
import PointsSection from './PointsSection.jsx'

const BulkForm = ({ bulkIndex, bulk, onChange }) => {
  const { name, paused } = bulk
  const { newConfig } = React.useContext(ConfigContext)
  const dataSource = newConfig?.south?.dataSources.find((southHandler) => southHandler.id === bulk.southId)
  const application = newConfig?.north?.applications.find((northHandler) => northHandler.id === bulk.northId)

  const handlePause = () => {
    onChange('paused', !paused)
  }

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
        {paused
          ? (
            <>
              <FaPauseCircle
                className="oi-icon-breadcrumb"
                size={20}
                onClick={(e) => {
                  e.preventDefault()
                  handlePause()
                }}
              />
              <Label className="status-text-breadcrumb text-success">Ongoing</Label>
            </>
          )
          : (
            <>
              <FaPlayCircle
                className="oi-icon-breadcrumb"
                size={20}
                onClick={(e) => {
                  e.preventDefault()
                  handlePause()
                }}
              />
              <Label className="status-text-breadcrumb text-warning">Paused</Label>
            </>
          )}
      </Row>
      <OIbTitle label="Handlers" />
      <Row>
        <Col md={1}>
          {'South handler: '}
          <a href={`/south/${bulk.southId}`}>{dataSource?.name}</a>
        </Col>
      </Row>
      <Row>
        <Col md={1}>
          {'North handler: '}
          <a href={`/north/${bulk.northId}`}>{application?.name}</a>
        </Col>
      </Row>
      <OIbTitle label="General settings" />
      <Row>
        <Col md={1}>
          <OIbCheckBox
            name="enabled"
            label="Enabled"
            defaultValue={false}
            value={bulk.enabled}
            help={<div>Enable this bulk</div>}
            onChange={onChange}
            switchButton
          />
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
          <p><strong>Last completed date: </strong></p>
        </Col>
      </Row>
      <Row>
        <Col md={8}>
          {bulk.points ? (
            <PointsSection bulk={bulk} bulkIndex={bulkIndex} />
          ) : (
            <>
              <OIbTitle label="Request" />
              <OIbTextArea label="Query" name="query" value={bulk.query} onChange={onChange} />
            </>
          )}
        </Col>
      </Row>
    </Form>
  )
}

BulkForm.propTypes = {
  bulkIndex: PropTypes.number.isRequired,
  bulk: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default BulkForm
