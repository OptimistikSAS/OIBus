import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Button, Col, Container, Form, Row } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa'
import { OibCheckbox, OibInteger, OibText, OibTextArea, OibTitle } from '../../components/oib-form/index.js'
import OibDate from '../../components/oib-form/oib-date.jsx'
import { ConfigContext } from '../../context/config-context.jsx'
import PointsSection from './points-section.jsx'
import apis from '../../service/apis.js'
import utils from '../../helpers/utils.js'
import { AlertContext } from '../../context/alert-context.jsx'
import ConnectorButton from '../connector-button.jsx'

const HistoryQueryForm = ({ query }) => {
  const [queryToUpdate, setQueryToUpdate] = useState(query)
  const [queryHasChanged, setQueryHasChanged] = useState(false)
  const [progressStatus, setProgressStatus] = useState({ status: query.status })

  const { newConfig } = React.useContext(ConfigContext)
  const [errors] = useState({})
  const south = newConfig?.south?.find(
    (southHandler) => southHandler.id === queryToUpdate.southId,
  )
  const north = newConfig?.north?.find(
    (northHandler) => northHandler.id === queryToUpdate.northId,
  )

  const { setAlert } = React.useContext(AlertContext)
  const navigate = useNavigate()

  const onEventSourceError = (error) => {
    console.error(error)
  }

  const onEventSourceMessage = (event) => {
    if (event && event.data) {
      const myData = JSON.parse(event.data)
      setProgressStatus({
        currentTime: myData.currentTime,
        progress: myData.progress,
        scanGroup: myData.scanGroup,
        status: myData.status,
      })
    }
  }

  React.useEffect(() => {
    const source = utils.createEventSource('/history-engine/sse', onEventSourceMessage, onEventSourceError)
    return () => {
      source.close()
    }
  }, [])

  React.useEffect(() => {
    let source
    if (queryToUpdate.enabled && queryToUpdate.status !== 'pending' && queryToUpdate.status !== 'finished') {
      source = utils.createEventSource(`/history-query/${queryToUpdate.id}/sse`, onEventSourceMessage, onEventSourceError)
    }
    return () => {
      source?.close()
    }
  }, [queryToUpdate])

  const handleEnabled = async () => {
    await apis.enableHistoryQuery(queryToUpdate.id, { enabled: !queryToUpdate.enabled })
    setQueryToUpdate({ ...queryToUpdate, enabled: !queryToUpdate.enabled })
  }

  const handleUpdateHistoryQuery = async () => {
    if (Object.values(errors).length === 0) {
      setAlert(null)
      await apis.updateHistoryQuery(queryToUpdate.id, { ...queryToUpdate })
      setQueryHasChanged(false)
    } else {
      setAlert({
        text: 'You have unresolved errors in configuration! Please fix before updating the settings.',
        type: 'danger',
      })
    }
  }

  const onChange = (propertyName, value) => {
    if (queryToUpdate[propertyName] !== value) {
      setQueryToUpdate({ ...queryToUpdate, [propertyName]: value })
      setQueryHasChanged(true)
    }
  }

  const onMaxReadIntervalChange = (_, value) => {
    if (queryToUpdate.settings.maxReadInterval !== value) {
      setQueryToUpdate({ ...queryToUpdate, settings: { ...queryToUpdate.settings, maxReadInterval: value } })
      setQueryHasChanged(true)
    }
  }

  const onReadIntervalDelayChange = (_, value) => {
    if (queryToUpdate.settings.readIntervalDelay !== value) {
      setQueryToUpdate({ ...queryToUpdate, settings: { ...queryToUpdate.settings, readIntervalDelay: value } })
      setQueryHasChanged(true)
    }
  }

  const onQueryChange = (_, value) => {
    if (queryToUpdate.settings.query !== value) {
      setQueryToUpdate({ ...queryToUpdate, settings: { ...queryToUpdate.settings, query: value } })
      setQueryHasChanged(true)
    }
  }

  const handleChangePoint = (_, value) => {
    setQueryToUpdate((oldQuery) => ({
      ...oldQuery,
      settings: {
        ...oldQuery.settings,
        points: value,
      },
    }))
    setQueryHasChanged(true)
  }

  /**
     * Returns the text color for each status
     * @param {string} status The status of the current history query
     * @returns {string} The color represented by the status
     */
  const statusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'text-warning mx-1'
      case 'exporting':
        return 'text-info mx-1'
      case 'importing':
        return 'text-primary mx-1'
      case 'finished':
        return 'text-success mx-1'
      default:
        return 'text-primary mx-1'
    }
  }

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
          {`| ${queryToUpdate.name}`}
        </h6>
      </div>
      <Container fluid>
        <Form className="m-2">
          <OibTitle label="Handlers" />
          <Row className="mb-2">
            <Col md={2}>
              <ConnectorButton
                connectorName={south?.name ?? ''}
                connectorUrl={`/south/${queryToUpdate.southId}`}
              />
              <FaArrowRight className="me-2" />
              <ConnectorButton
                connectorName={north?.name ?? ''}
                connectorUrl={`/north/${queryToUpdate.northId}`}
              />
            </Col>
          </Row>
          <OibTitle label="General settings" />
          <Row>
            <Col md={2}>
              <OibCheckbox
                name="enabled"
                label="Enabled"
                defaultValue={false}
                value={!!queryToUpdate.enabled}
                help={<div>Enable this history query</div>}
                onChange={handleEnabled}
              />
            </Col>
            <Col md={2}>
              <Button
                disabled={!queryHasChanged}
                color="primary"
                onClick={() => handleUpdateHistoryQuery()}
              >
                Save
              </Button>
            </Col>
          </Row>
          <OibTitle label="Progress status" />
          <Row className="mb-2">
            <Col md={3}>
              <div>
                <span><b>Status:</b></span>
                <span className={statusColor(progressStatus.status)}>{progressStatus.status}</span>
              </div>
            </Col>
            {progressStatus.currentTime ? (
              <Col md={3}>
                <div>
                  <span><b>Current time:</b></span>
                  <span className="mx-1">{progressStatus.currentTime}</span>
                </div>
              </Col>
            ) : null}
            {progressStatus.progress ? (
              <Col md={6}>
                <div>
                  <span><b>Export progress:</b></span>
                  <span className="mx-1">
                    {progressStatus.progress}
                    %
                  </span>
                  {progressStatus.scanGroup && (
                    <span className="mx-1">
                      (for scan group
                      {' '}
                      {progressStatus.scanGroup}
                      )
                    </span>
                  )}
                </div>
              </Col>
            ) : null}
          </Row>
          <OibTitle label="Settings" />
          <Row>
            <Col md={2}>
              <OibDate
                name="startTime"
                value={queryToUpdate.startTime}
                label="From date"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OibDate
                name="endTime"
                value={queryToUpdate.endTime}
                label="To date"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OibInteger
                name="maxReadInterval"
                label="Max read interval (s)"
                value={queryToUpdate.settings.maxReadInterval}
                defaultValue={3600}
                onChange={onMaxReadIntervalChange}
                help={<div>Put 0 to not split the query</div>}
              />
            </Col>
            <Col md={2}>
              <OibInteger
                name="readIntervalDelay"
                label="Read interval delay (ms)"
                value={queryToUpdate.settings.readIntervalDelay}
                defaultValue={200}
                onChange={onReadIntervalDelayChange}
              />
            </Col>
          </Row>
          <Row>
            <Col md={2}>
              <OibText
                label="File pattern"
                name="filePattern"
                value={queryToUpdate.filePattern}
                defaultValue="./@ConnectorName-@CurrentDate-@QueryPart.csv"
                onChange={onChange}
              />
            </Col>
            <Col md={2}>
              <OibCheckbox
                name="compress"
                label="Compress"
                defaultValue={false}
                value={!!queryToUpdate.compress}
                onChange={onChange}
              />
            </Col>
          </Row>
          <Row>
            <Col md={8}>
              {queryToUpdate.settings?.points ? (
                <PointsSection
                  query={queryToUpdate}
                  handleChange={handleChangePoint}
                />
              ) : (
                <>
                  <OibTitle label="Request" />
                  <OibTextArea
                    label="Query"
                    name="query"
                    contentType="sql"
                    value={queryToUpdate.settings?.query}
                    onChange={onQueryChange}
                    help={
                      (
                        <div>
                          Available variables: @StartTime, @EndTime.
                          Be sure to use both variables to split the query with the Max read
                          interval field.
                        </div>
                      )
                    }
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

HistoryQueryForm.propTypes = { query: PropTypes.object.isRequired }

export default HistoryQueryForm
