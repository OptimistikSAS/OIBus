import React, { useEffect } from 'react'
import {
  FormGroup,
  FormText,
  Label,
  Button,
  Input,
  Table,
  Card,
  CardBody,
  Row,
  Col, Container,
} from 'reactstrap'
import apis from '../service/apis'
import { AlertContext } from '../context/alert-context.jsx'

const selectStyle = (level) => {
  switch (level) {
    case 'debug':
      return 'text-info'
    case 'info':
      return 'text-success'
    case 'warn':
      return 'text-warning'
    case 'error':
      return 'text-danger'
    default:
      return 'text-primary'
  }
}

const Log = () => {
  const verbosityOptions = ['error', 'warn', 'info', 'debug', 'trace']
  const defaultMaxLog = 300
  const [fromDate, setFromDate] = React.useState()
  const [toDate, setToDate] = React.useState()
  const [verbosity, setVerbosity] = React.useState(verbosityOptions)
  const [logs, setLogs] = React.useState([])
  const [filterText, setFilterText] = React.useState('')
  const [maxLog, setMaxLog] = React.useState(defaultMaxLog)
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Retrieve the logs from sqlite database
   * @returns {void}
   */
  const retrieveLogs = async () => {
    try {
      const logsResponse = await apis.getLogs(fromDate, toDate, verbosity.join(','))
      // sort logs based on timestamp
      logsResponse.sort((a, b) => {
        if (a.timestamp < b.timestamp) {
          return 1
        }
        if (b.timestamp < a.timestamp) {
          return -1
        }
        return 0
      })
      setLogs(logsResponse)
      setMaxLog(defaultMaxLog)
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  useEffect(() => {
    retrieveLogs()
  }, [])

  /**
   * Handles the form's submission and set the logs if any response
   * @param {string} value checked/unchecked item
   * @returns {void}
   */
  const handleVerbosityChange = (value) => {
    if (verbosity.includes(value)) {
      setVerbosity(verbosity.filter((item) => item !== value))
    } else {
      setVerbosity([...verbosity, value])
    }
  }

  /**
   * Render the filter options for logs
   * @returns {object} - The form group to display
   */
  const renderFilter = () => (
    <FormGroup row>
      <Label sm={1} for="filterText">
        Filter
      </Label>
      <Col sm={11}>
        <Input
          className="oi-form-input"
          type="text"
          id="filterText"
          placeholder="message contains..."
          value={filterText}
          onChange={(event) => {
            setMaxLog(defaultMaxLog)
            setFilterText(event.target.value.toLowerCase())
          }}
        />
      </Col>
    </FormGroup>
  )

  /**
   * Render the logs
   * @param {Array} filteredLogs - the list of logs filtered
   * @returns {JSX.Element} - The HTML array of logs
   */
  const renderLogs = (filteredLogs) => (
    <Col className="log-right-panel">
      <Card>
        <Label className="label-card-title">Logs</Label>
        <CardBody className="card-body">
          {renderFilter()}
          <Table size="small" bordered hover responsive>
            <thead>
              <tr>
                <td>Date</td>
                <td>Level</td>
                <td>Scope</td>
                <td>Source file</td>
                <td>Details</td>
              </tr>
            </thead>
            <tbody>
              {filteredLogs
                .filter((_, index) => index < maxLog)
                .map((item) => {
                  const { id, source, scope, level, message, timestamp } = item
                  const date = new Date(timestamp)
                  return (
                    <tr key={id} className={`oi-log ${selectStyle(level)}`}>
                      <td style={{ width: 120 }}>{`${date.toLocaleDateString()}-${date.toLocaleTimeString()}`}</td>
                      <td>{level}</td>
                      <td>{scope}</td>
                      <td>{source}</td>
                      <td>{message}</td>
                    </tr>
                  )
                })}
            </tbody>
          </Table>
          {filteredLogs.length > maxLog && (
          <Button id="showMore" color="primary" onClick={() => setMaxLog(maxLog + defaultMaxLog)}>
            Show more...
          </Button>
          )}
        </CardBody>
      </Card>
    </Col>
  )

  const maxDateString = new Date().toISOString().substr(0, 16)
  return (
    <Container fluid>
      <Row className="p-3">
        <Col className="log-left-panel">
          <Card>
            <Label className="label-card-title">Filters</Label>
            <CardBody className="card-body">
              <FormGroup>
                <Label for="fromDate">From date</Label>
                <Input
                  className="oi-form-input"
                  type="datetime-local"
                  id="fromDate"
                  max={maxDateString}
                  placeholder="yyyy-mm-ddThh:mm:ss+hh:mm"
                  required
                  onChange={(event) => {
                    const date = new Date(event.target.value).toISOString()
                    setFromDate(date)
                  }}
                />
                <FormText color="muted">default: Current datetime - 24 hours (now - 24 hours)</FormText>
              </FormGroup>

              <FormGroup>
                <Label for="toDate">To date</Label>
                <Input
                  className="oi-form-input"
                  type="datetime-local"
                  id="toDate"
                  max={maxDateString}
                  placeholder="yyyy-mm-ddThh:mm:ss+hh:mm"
                  required
                  onChange={(event) => {
                    const date = new Date(event.target.value).toISOString()
                    setToDate(date)
                  }}
                />
                <FormText color="muted">default: Current datetime (now)</FormText>
              </FormGroup>

              <FormGroup>
                <Label for="verbosity">Verbosity</Label>
                {verbosityOptions.map((item) => (
                  <FormGroup check className={`${selectStyle(item)}`} key={item}>
                    <Label check>
                      <Input
                        className="oi-form-input"
                        type="checkbox"
                        id="verbosity"
                        onChange={() => handleVerbosityChange(item)}
                        checked={verbosity.includes(item)}
                      />
                      {item}
                    </Label>
                  </FormGroup>
                ))}
              </FormGroup>
              <Button id="showLog" color="primary" onClick={retrieveLogs}>
                Show log
              </Button>
            </CardBody>
          </Card>
        </Col>
        {logs && renderLogs(logs.filter((item) => item.message.toLowerCase().includes(filterText)))}
      </Row>
    </Container>
  )
}
export default Log
