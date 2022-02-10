import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col, Label, Button, Container } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { FaPauseCircle, FaPlayCircle, FaArrowLeft } from 'react-icons/fa'
import { act } from 'react-dom/test-utils'
import {
  OIbTitle,
  OIbCheckBox,
  OIbText,
  OIbTextArea,
} from '../../components/OIbForm'
import OIbDate from '../../components/OIbForm/OIbDate.jsx'
import { ConfigContext } from '../../context/ConfigContext.jsx'
import PointsSection from './PointsSection.jsx'
import apis from '../../services/apis'

const HistoryQueryForm = ({ queryIndex, query, onChange }) => {
  const { name, paused } = query
  const { newConfig } = React.useContext(ConfigContext)
  const [lastCompleted, setLastCompleted] = useState()
  const dataSource = newConfig?.south?.dataSources.find(
    (southHandler) => southHandler.id === query.southId,
  )
  const application = newConfig?.north?.applications.find(
    (northHandler) => northHandler.id === query.northId,
  )
  const navigate = useNavigate()
  const handlePause = () => {
    onChange('paused', !paused)
  }

  useEffect(() => {
    apis
      .getLastCompletedForHistoryQuery()
      .then((response) => {
        act(() => {
          setLastCompleted(response)
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }, [])

  return (
    <>
      <div className="d-flex align-items-center w-100 oi-sub-nav mb-2">
        <h6 className="text-muted d-flex align-items-center pl-3 pt-1 ml-2">
          <Button
            id="oi-navigate"
            outline
            onClick={() => {
              navigate(-1)
            }}
            className="util-button"
          >
            <FaArrowLeft className="oi-back-icon mr-2" />
          </Button>
          {`| ${name}`}
          {paused ? (
            <>
              <FaPauseCircle
                className="oi-icon-breadcrumb"
                size={15}
                onClick={(e) => {
                  e.preventDefault()
                  handlePause()
                }}
              />
              <Label className="status-text-breadcrumb text-success">
                Ongoing
              </Label>
            </>
          ) : (
            <>
              <FaPlayCircle
                className="oi-icon-breadcrumb"
                size={15}
                onClick={(e) => {
                  e.preventDefault()
                  handlePause()
                }}
              />
              <Label className="status-text-breadcrumb text-warning">
                Paused
              </Label>
            </>
          )}
        </h6>
      </div>
      <Container fluid>
        <Form className="m-2">
          <OIbTitle label="Handlers" />
          <Row className="mb-2">
            <Col md={2}>
              <a href={`/south/${query.southId}`}>{dataSource?.name}</a>
              {'  ->  '}
              <a href={`/north/${query.northId}`}>{application?.name}</a>
            </Col>
          </Row>
          <OIbTitle label="General settings" />
          <Row>
            <Col md={2}>
              <OIbCheckBox
                name="enabled"
                label="Enabled"
                defaultValue={false}
                value={query.enabled}
                help={<div>Enable this history query</div>}
                onChange={onChange}
                switchButton
              />
            </Col>
          </Row>
          <Row>
            <Col md={2}>
              <OIbDate
                name="startTime"
                value={query.startTime}
                label="From date"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OIbDate
                name="endTime"
                value={query.endTime}
                label="To date"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OIbText
                label="File pattern"
                name="filePattern"
                value={query.filePattern}
                defaultValue="./cache"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OIbCheckBox
                name="compress"
                label="Compress"
                defaultValue={false}
                value={query.compress}
                onChange={onChange}
              />
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <div>
                <strong>Last completed dates: </strong>
                <div className="mb-2">
                  {lastCompleted?.south.length ? (
                    <table className="last-completed-table">
                      <thead>
                        <tr>
                          <th>Scan mode</th>
                          <th>Last completed date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastCompleted?.south.map((obj) => (
                          <tr>
                            <td>{obj.scanMode}</td>
                            <td>{obj.lastCompletedDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    'Nothing to show'
                  )}
                </div>
              </div>
            </Col>
          </Row>
          <Row>
            <Col md={8}>
              {query.points ? (
                <PointsSection query={query} queryIndex={queryIndex} />
              ) : (
                <>
                  <OIbTitle label="Request" />
                  <OIbTextArea
                    label="Query"
                    name="query"
                    value={query.query}
                    onChange={onChange}
                  />
                </>
              )}
            </Col>
          </Row>
        </Form>
      </Container>
    </>
  )
}

HistoryQueryForm.propTypes = {
  queryIndex: PropTypes.number.isRequired,
  query: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default HistoryQueryForm
