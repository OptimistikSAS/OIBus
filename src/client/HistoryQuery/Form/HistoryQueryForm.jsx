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

const HistoryQueryForm = ({ query }) => {
  const [queryToUpdate, setQueryToUpdate] = useState(query)
  const { name, paused } = queryToUpdate
  const { newConfig } = React.useContext(ConfigContext)
  const [lastCompleted, setLastCompleted] = useState()
  const dataSource = newConfig?.south?.dataSources.find(
    (southHandler) => southHandler.id === queryToUpdate.southId,
  )
  const application = newConfig?.north?.applications.find(
    (northHandler) => northHandler.id === queryToUpdate.northId,
  )
  const navigate = useNavigate()

  const handlePause = async () => {
    await apis.pauseHistoryQuery(queryToUpdate.id, { paused: !paused })
    setQueryToUpdate({ ...queryToUpdate, paused: !queryToUpdate.paused })
  }

  const handleEnabled = async () => {
    await apis.enableHistoryQuery(queryToUpdate.id, { enabled: !queryToUpdate.enabled })
    setQueryToUpdate({ ...queryToUpdate, enabled: !queryToUpdate.enabled })
  }

  useEffect(() => {
    // TODO: Fails on backend
    apis
      .getLastCompletedForHistoryQuery(queryToUpdate.id)
      .then((response) => {
        act(() => {
          setLastCompleted(response)
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }, [])

  const handleUpdateHistoryQuery = async () => {
    await apis.updateHistoryQuery(queryToUpdate.id, { ...queryToUpdate })
  }

  const onChange = (propertyName, value) => {
    setQueryToUpdate({ ...queryToUpdate, [propertyName]: value })
  }

  const handleAddQuery = (_, value) => {
    setQueryToUpdate({ ...queryToUpdate, settings: { query: value } })
  }

  const handleAddPoint = () => {
    setQueryToUpdate({ ...queryToUpdate, settings: { points: [...queryToUpdate.settings.points, {}] } })
  }

  // const handleDeletePoint = () => {
  //   setQueryToUpdate({ ...queryToUpdate, settings: { points: [...queryToUpdate.settings.points, {}] } })
  // }

  // const handleDeleteAllPoint = () => {
  //   setQueryToUpdate({ ...queryToUpdate, settings: { points: [...queryToUpdate.settings.points, {}] } })
  // }

  // const handleImportPoints = () => {
  //   setQueryToUpdate({ ...queryToUpdate, settings: { points: [...queryToUpdate.settings.points, {}] } })
  // }

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
              <a href={`/south/${queryToUpdate.southId}`}>{dataSource?.name}</a>
              {'  ->  '}
              <a href={`/north/${queryToUpdate.northId}`}>{application?.name}</a>
            </Col>
          </Row>
          <OIbTitle label="General settings" />
          <Row>
            <Col md={2}>
              <OIbCheckBox
                name="enabled"
                label="Enabled"
                defaultValue={false}
                value={queryToUpdate.enabled}
                help={<div>Enable this history query</div>}
                onChange={handleEnabled}
                switchButton
              />
            </Col>
          </Row>
          <Row>
            <Col md={2}>
              <OIbDate
                name="startTime"
                value={queryToUpdate.startTime}
                label="From date"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OIbDate
                name="endTime"
                value={queryToUpdate.endTime}
                label="To date"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OIbText
                label="File pattern"
                name="filePattern"
                value={queryToUpdate.filePattern}
                defaultValue="./@ConnectorName-@CurrentDate-@QueryPart.csv"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OIbCheckBox
                name="compress"
                label="Compress"
                defaultValue={false}
                value={queryToUpdate.compress}
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
              {queryToUpdate.settings.points ? (
                <PointsSection
                  query={queryToUpdate}
                  handleAddPoint={handleAddPoint}
                />
              ) : (
                <>
                  <OIbTitle label="Request" />
                  <OIbTextArea
                    label="Query"
                    name="query"
                    value={queryToUpdate.settings?.query}
                    onChange={handleAddQuery}
                  />
                </>
              )}
            </Col>
          </Row>
          <Row>
            <Col md={2}>
              <Button color="primary" onClick={() => handleUpdateHistoryQuery()}>
                Save history query
              </Button>
            </Col>
          </Row>
        </Form>
      </Container>
    </>
  )
}

HistoryQueryForm.propTypes = { query: PropTypes.object.isRequired }

export default HistoryQueryForm
