import React, { useEffect } from 'react'
import {
  FormGroup,
  Label,
  Button,
  Input,
  Table,
  Card,
  CardBody,
  Row,
  Col, 
  Container,
} from 'reactstrap'
import apis from '../service/apis.js'
import { useLocation } from 'react-router-dom'
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
  const defaultMaxLog = 300
  const defaultMaxPageSize = 10
  const defaultActivePage = 1

  const { search } = useLocation()
  const params = new URLSearchParams(search)

  const auxDate = new Date() // Today
  const [toDate, setToDate] = React.useState()
  auxDate.setDate(auxDate.getDate() - 1) // Yesterday
  const [fromDate, setFromDate] = React.useState(auxDate.toISOString())

  const [verbosity, setVerbosity] = React.useState(verbosityOptions)
  const [logs, setLogs] = React.useState([])
  const [filterText, setFilterText] = React.useState('')
  const [scope, setScope] = React.useState('')
  const [maxPageSize, setMaxPageSize] = React.useState(defaultMaxPageSize)
  const [activePageNumber, setActivePageNumber] = React.useState(defaultActivePage)
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Retrieve the logs from sqlite database
   * @returns {void}
   */
  const retrieveLogs = async () => {
    try {
      const logsResponse = await apis.getLogs(fromDate, toDate, activePageNumber-1, verbosity.join(','),filterText,scope)
      setLogs(logsResponse.content)
      setMaxPageSize(logsResponse.totalNumberOfPages)
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  useEffect(() => {
    retrieveLogs()
  }, [activePageNumber,fromDate,toDate,verbosity,filterText,scope])

  /**
   * Handles the form's submission and set the logs if any response
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
    console.log("Selected page is:" + pageNumber)
    setActivePageNumber(pageNumber)
  }

  /**
   * Render the filter options for logs
   * @returns {object} - The form group to display
   */
  const renderFilter = () => (
    <FormGroup row>
      <Label sm={1} for="filterText">
        Text Filter
      </Label>
      <Col sm={11}>
        <Input
          className="oi-form-input"
          type="text"
          id="filterText"
          placeholder="message contains..."
          value={filterText}
          onChange={(event) => {
            setFilterText(event.target.value.toLowerCase())
          }}
        />
      </Col>
      <Label sm={1} for="filterText">
        Scope Filter
      </Label>
      <Col sm={11}>
        <Input
          className="oi-form-input"
          type="text"
          id="scope"
          placeholder="scope contains..."
          value={scope}
          onChange={(event) => {
            setScope(event.target.value.toLowerCase())
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
    </Col>
  )

  return (
    <Container fluid>
      <Row>
      <TablePagination
        maxToDisplay={Math.min(maxPageSize,10)}
        selected={activePageNumber}
        total={maxPageSize}
        onPagePressed={(event) => handlePageSelection(event)}
      />
      </Row>
      <Row className="p-3">
        <Col className="log-left-panel">
          <Card>
            <Label className="label-card-title">Filters</Label>
            <CardBody className="card-body">
              <FormGroup>
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
              </FormGroup>

              <FormGroup>
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
            </CardBody>
          </Card>
        </Col>
        <Col>

          <Row>
            {logs && renderLogs(logs)}
          </Row>
        </Col>
      </Row>

    </Container>
  )
}
export default Log
