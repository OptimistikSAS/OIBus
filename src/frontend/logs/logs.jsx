import React, { useEffect } from 'react'
import {
  FormGroup,
  Label,
  Input,
  Table,
  Card,
  CardBody,
  Row,
  Col,
  Container,
} from 'reactstrap'
import apis from '../service/apis.js'
import { AlertContext } from '../context/alert-context.jsx'
import OibDate from '../components/oib-form/oib-date.jsx'
import TablePagination from '../components/table/table-pagination.jsx'

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
  const defaultMaxPageSize = 10
  const [maxPageSize, setMaxPageSize] = React.useState(defaultMaxPageSize)
  const auxDate = new Date() // Today
  const [toDate, setToDate] = React.useState()
  auxDate.setDate(auxDate.getDate() - 1) // Yesterday
  const [fromDate, setFromDate] = React.useState(auxDate.toISOString())
  const [verbosity, setVerbosity] = React.useState(verbosityOptions)
  const [logs, setLogs] = React.useState([])
  const [textFilter, setTextFilter] = React.useState('')
  const [scopeFilter, setScopeFilter] = React.useState('')
  const defaultActivePage = 1
  const [activePageNumber, setActivePageNumber] = React.useState(defaultActivePage)
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Retrieve the logs from sqlite database
   * @returns {void}
   */
  const retrieveLogs = async () => {
    try {
      const logsResponse = await apis.getLogs(fromDate, toDate, activePageNumber - 1, verbosity.join(','), textFilter, scopeFilter)
      setLogs(logsResponse.content)
      setMaxPageSize(logsResponse.totalNumberOfPages)
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  useEffect(() => {
    retrieveLogs()
  }, [activePageNumber, fromDate, toDate, verbosity, textFilter, scopeFilter])

  /**
   * Handles the form's verbosity changes
   * @param {string} value checked/unchecked item
   * @returns {void}
   */
  const handleVerbosityChange = (value) => {
    setActivePageNumber(defaultActivePage)
    if (verbosity.includes(value)) {
      setVerbosity(verbosity.filter((item) => item !== value))
    } else {
      setVerbosity([...verbosity, value])
    }
  }

  const handlePageSelection = (pageNumber) => {
    setActivePageNumber(pageNumber)
  }

  /**
   * Render the filter options for logs
   * @returns {object} - The form group to display
   */
  const renderFilter = () => (
    <>
      <Row>
        <Col className="col-sm-auto">
          <Row>
            <Col className="col-sm-auto">
              <OibDate
                name="start"
                label="From"
                value={fromDate}
                onChange={(_name, newVal, _valid) => {
                  const date = new Date(newVal).toISOString()
                  setActivePageNumber(defaultActivePage)
                  setFromDate(date)
                }}
                help="default: Current datetime - 24 hours (now - 24 hours)"
              />
            </Col>
            <Col className="col-sm-auto">
              <OibDate
                name="end"
                label="To"
                value={toDate}
                onChange={(_name, newVal, _valid) => {
                  const date = new Date(newVal).toISOString()
                  setActivePageNumber(defaultActivePage)
                  setToDate(date)
                }}
                help="default: Current datetime (now)"
              />
            </Col>
          </Row>
        </Col>
        <Col>

          <Row className="align-items-sm-baseline">
            <Label className="col-sm-auto" for="filterText">
              Text Filter
            </Label>
            <Col>
              <Input
                className="oi-form-input"
                type="text"
                id="filterText"
                placeholder="message contains..."
                value={textFilter}
                onChange={(event) => {
                  setTextFilter(event.target.value.toLowerCase())
                }}
              />
            </Col>
            <Label className="col-sm-auto" for="filterText">
              Scope Filter
            </Label>
            <Col>
              <Input
                className="oi-form-input"
                type="text"
                id="scope"
                placeholder="scope contains..."
                value={scopeFilter}
                onChange={(event) => {
                  setScopeFilter(event.target.value.toLowerCase())
                }}
              />
            </Col>
          </Row>
        </Col>
      </Row>
      <Row>
        <Col className="col-sm-auto">
          <Label for="verbosity">Verbosity</Label>
        </Col>
        {verbosityOptions.map((item) => (
          <Col className="col-sm-auto">
            <FormGroup check className={`${selectStyle(item)}`} key={item}>
              <Label>
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
          </Col>
        ))}
      </Row>
    </>
  )

  /**
   * Render the logs
   * @param {Array} filteredLogs - the list of logs filtered
   * @returns {JSX.Element} - The HTML array of logs
   */
  const renderLogs = (filteredLogs) => (
    <Card>
      <Label className="label-card-title">Logs</Label>
      <CardBody className="card-body">

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
      </CardBody>
    </Card>
  )

  return (
    <Container fluid>
      <Row className="p-2">
        <Card>
          <CardBody className="card-body">
            {renderFilter()}
          </CardBody>
        </Card>
      </Row>
      <Row>
        <Col className="d-flex justify-content-center">
          <TablePagination
            maxToDisplay={Math.min(maxPageSize, 10)}
            selected={activePageNumber}
            total={maxPageSize}
            onPagePressed={(event) => handlePageSelection(event)}
          />
        </Col>
      </Row>
      <Row className="p-2">
        {logs && renderLogs(logs)}
      </Row>
    </Container>
  )
}
export default Log
