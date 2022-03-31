import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Button, Col, Container, Form, Label, Row } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight, FaPauseCircle, FaPlayCircle } from 'react-icons/fa'
import { OIbCheckBox, OIbInteger, OIbText, OIbTextArea, OIbTitle } from '../../components/OIbForm'
import OIbDate from '../../components/OIbForm/OIbDate.jsx'
import { ConfigContext } from '../../context/ConfigContext.jsx'
import PointsSection from './PointsSection.jsx'
import apis from '../../services/apis'
import utils from '../../helpers/utils'
import { AlertContext } from '../../context/AlertContext.jsx'
import ConnectorButton from '../ConnectorButton.jsx'

const HistoryQueryForm = ({ query }) => {
  const [queryToUpdate, setQueryToUpdate] = useState(query)
  const [progressStatus, setProgressStatus] = useState({ status: query.status })

  const { name, paused } = queryToUpdate
  const { newConfig } = React.useContext(ConfigContext)
  const [errors, setErrors] = useState({})
  const dataSource = newConfig?.south?.dataSources.find(
    (southHandler) => southHandler.id === queryToUpdate.southId,
  )
  const application = newConfig?.north?.applications.find(
    (northHandler) => northHandler.id === queryToUpdate.northId,
  )

  const { setAlert } = React.useContext(AlertContext)
  const navigate = useNavigate()

  React.useEffect(() => {
    let source
    if (progressStatus.status !== 'finished' && progressStatus.status !== 'pending') {
      source = new EventSource(`/history/${queryToUpdate.id}/sse`)
      source.onerror = (error) => {
        console.error(error)
      }

      source.onmessage = (event) => {
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
    }

    return () => {
      source?.close()
    }
  }, [queryToUpdate])

  const handlePause = async () => {
    await apis.pauseHistoryQuery(queryToUpdate.id, { paused: !paused })
    setQueryToUpdate({ ...queryToUpdate, paused: !queryToUpdate.paused })
  }

  const handleEnabled = async () => {
    await apis.enableHistoryQuery(queryToUpdate.id, { enabled: !queryToUpdate.enabled })
    setQueryToUpdate({ ...queryToUpdate, enabled: !queryToUpdate.enabled })
  }

  const handleUpdateHistoryQuery = async () => {
    if (Object.values(errors).length === 0) {
      setAlert(null)
      await apis.updateHistoryQuery(queryToUpdate.id, { ...queryToUpdate })
    } else {
      setAlert({
        text: 'You have unresolved errors in configuration! Please fix before updating the settings.',
        type: 'danger',
      })
    }
  }

  const onChange = (propertyName, value) => {
    setQueryToUpdate({ ...queryToUpdate, [propertyName]: value })
  }

  const onMaxReadIntervalChange = (_, value) => {
    setQueryToUpdate({ ...queryToUpdate, settings: { ...queryToUpdate.settings, maxReadInterval: value } })
  }

  const onReadIntervalDelayChange = (_, value) => {
    setQueryToUpdate({ ...queryToUpdate, settings: { ...queryToUpdate.settings, readIntervalDelay: value } })
  }

  const handleAddQuery = (_, value) => {
    setQueryToUpdate({ ...queryToUpdate, settings: { ...queryToUpdate.settings, query: value } })
  }

  const handleAddPoint = (attributes) => {
    const newPointAttributes = {}
    attributes.forEach((attribute) => {
      newPointAttributes[attribute] = ''
    })
    setQueryToUpdate(
      {
        ...queryToUpdate,
        settings: {
          ...queryToUpdate.settings,
          points: [...queryToUpdate.settings.points, { ...newPointAttributes }],
        },
      },
    )
  }

  const handleChangePoint = (attributeDescription, value, validity) => {
    if (validity) {
      setErrors((oldErrors) => ({ ...oldErrors, [attributeDescription]: validity }))
    } else {
      const copyErrorObject = errors
      delete copyErrorObject[attributeDescription]
      setErrors(copyErrorObject)
    }

    const attributeName = attributeDescription.split('.')[2]
    const pointIndex = Number(attributeDescription.split('.')[1])
    setQueryToUpdate((oldQuery) => ({
      ...oldQuery,
      settings: {
        ...oldQuery.settings,
        points: oldQuery.settings.points.map((point, index) => {
          if (pointIndex === index) {
            return { ...point, [attributeName]: value }
          }
          return point
        }),
      },
    }))
  }

  const handleDeletePoint = (indexInTable) => {
    setQueryToUpdate((oldQuery) => ({
      ...oldQuery,
      settings: {
        ...oldQuery.settings,
        points: oldQuery.settings.points.filter((_point, index) => index !== indexInTable),
      },
    }))
    Object.keys(errors).forEach((errorKey) => {
      if (errorKey.split('.')[1] === String(indexInTable)) delete errors[errorKey]
    })
  }

  const handleDeleteAllPoint = () => {
    setQueryToUpdate({ ...queryToUpdate, settings: { ...queryToUpdate.settings, points: [] } })
  }

  const handleImportPoints = async (file) => {
    try {
      const text = await utils.readFileContent(file)
      utils
        .parseCSV(text)
        .then((newPoints) => {
          setQueryToUpdate({
            ...queryToUpdate,
            settings: { ...queryToUpdate.settings, points: [...queryToUpdate.settings.points, ...newPoints] },
          })
        })
        .catch((error) => {
          console.error(error)
          setAlert({ text: error.message, type: 'danger' })
        })
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  const checkIfQueryHasChanged = () => JSON.stringify(queryToUpdate.settings) === JSON.stringify(query.settings)
        || queryToUpdate.startTime !== query.startTime || queryToUpdate.endTime !== query.endTime
        || queryToUpdate.filePattern !== query.filePattern
        || queryToUpdate.compress !== query.compress

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
          {`| ${name}`}
        </h6>
      </div>
      <Container fluid>
        <Form className="m-2">
          <OIbTitle label="Handlers" />
          <Row className="mb-2">
            <Col md={2}>
              <ConnectorButton
                connectorName={dataSource?.name ?? ''}
                connectorUrl={`/south/${queryToUpdate.southId}`}
              />
              <FaArrowRight className="me-2" />
              <ConnectorButton
                connectorName={application?.name ?? ''}
                connectorUrl={`/north/${queryToUpdate.northId}`}
              />
            </Col>
          </Row>
          <OIbTitle label="General settings" />
          <Row>
            <Col md={2}>
              <OIbCheckBox
                name="enabled"
                label="Enabled"
                defaultValue={false}
                value={!!queryToUpdate.enabled}
                help={<div>Enable this history query</div>}
                onChange={handleEnabled}
                switchButton
              />
            </Col>
            {queryToUpdate.enabled && progressStatus.status !== 'finished' ? (
              <Col md={2}>
                {paused ? (
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
                ) : (
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
                )}
              </Col>
            ) : null}
            <Col md={2}>
              <Button
                disabled={checkIfQueryHasChanged()}
                color="primary"
                onClick={() => handleUpdateHistoryQuery()}
              >
                Save
              </Button>
            </Col>
          </Row>
          <OIbTitle label="Progress status" />
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
                      {progressStatus.scanGroup}
                      )
                    </span>
                  )}
                </div>
              </Col>
            ) : null}
          </Row>
          <OIbTitle label="Settings" />
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
              <OIbInteger
                name="maxReadInterval"
                label="Max read interval (s)"
                value={queryToUpdate.settings.maxReadInterval}
                defaultValue={3600}
                onChange={onMaxReadIntervalChange}
                help={<div>Put 0 to not split the query</div>}
              />
            </Col>
            <Col md={2}>
              <OIbInteger
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
                value={!!queryToUpdate.compress}
                onChange={onChange}
              />
            </Col>
          </Row>
          <Row>
            <Col md={8}>
              {queryToUpdate.settings.points ? (
                <PointsSection
                  query={queryToUpdate}
                  handleAddPoint={handleAddPoint}
                  handleChange={handleChangePoint}
                  handleDeletePoint={handleDeletePoint}
                  handleDeleteAllPoint={handleDeleteAllPoint}
                  handleImportPoints={handleImportPoints}
                />
              ) : (
                <>
                  <OIbTitle label="Request" />
                  <OIbTextArea
                    label="Query"
                    name="query"
                    contentType="sql"
                    value={queryToUpdate.settings?.query}
                    onChange={handleAddQuery}
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
