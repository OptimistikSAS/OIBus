import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col, Label, Button } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { FaPauseCircle, FaPlayCircle, FaArrowLeft } from 'react-icons/fa'
import { OIbTitle, OIbCheckBox, OIbText, OIbTextArea } from '../../components/OIbForm'
import OIbDate from '../../components/OIbForm/OIbDate.jsx'
import { ConfigContext } from '../../context/configContext.jsx'
import PointsSection from './PointsSection.jsx'

const HistoryQueryForm = ({ bulkIndex, bulk, onChange }) => {
  const { name, paused } = bulk
  const { newConfig } = React.useContext(ConfigContext)
  const dataSource = newConfig?.south?.dataSources.find((southHandler) => southHandler.id === bulk.southId)
  const application = newConfig?.north?.applications.find((northHandler) => northHandler.id === bulk.northId)
  const navigate = useNavigate()
  const handlePause = () => {
    onChange('paused', !paused)
  }

  return (
    <Form>
      <Row>
        <div className="d-flex align-items-center w-100 oi-sub-nav mb-2">
          <h6 className="text-muted d-flex align-items-center pl-3 pt-1 ml-2">
            <Button
              close
              onClick={() => {
                navigate(-1)
              }}
            >
              <FaArrowLeft className="oi-icon mr-2" />
            </Button>
            {`| ${name}`}
            {paused
              ? (
                <>
                  <FaPauseCircle
                    className="oi-icon-breadcrumb"
                    size={15}
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
                    size={15}
                    onClick={(e) => {
                      e.preventDefault()
                      handlePause()
                    }}
                  />
                  <Label className="status-text-breadcrumb text-warning">Paused</Label>
                </>
              )}
          </h6>
        </div>
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

HistoryQueryForm.propTypes = {
  bulkIndex: PropTypes.number.isRequired,
  bulk: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default HistoryQueryForm
