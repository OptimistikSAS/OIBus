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
  Col, Container,
  Pagination,
  PaginationItem,
  PaginationLink,
} from 'reactstrap'
import apis from '../service/apis.js'
import { useLocation } from 'react-router-dom'
import { AlertContext } from '../context/alert-context.jsx'
import OibDate from '../components/oib-form/oib-date.jsx'

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
  const defaultPageSize = 10
  const defaultPageNumber = 0
  const PAGE_NEIGHBOUR_LIMIT = 3

  const { search } = useLocation()
  const params = new URLSearchParams(search)

  const auxDate = new Date() // Today
  const [toDate, setToDate] = React.useState()
  auxDate.setDate(auxDate.getDate() - 1) // Yesterday
  const [fromDate, setFromDate] = React.useState(auxDate.toISOString())

  const [verbosity, setVerbosity] = React.useState(verbosityOptions)
  const [logs, setLogs] = React.useState([])
  const [filterText, setFilterText] = React.useState('')
  const [maxLog, setMaxLog] = React.useState(defaultMaxLog)
  const [maxPageSize, setMaxPageSize] = React.useState(defaultMaxPageSize)
  const [pageSize, setPageSize] = React.useState(parseInt(params.get('pageSize')) || defaultPageSize)
  const [pageNumber, setPageNumber] = React.useState(parseInt(params.get('pageNumber')) || defaultPageNumber)
  const [startPageNumber] = React.useState(pageNumber > PAGE_NEIGHBOUR_LIMIT ? pageNumber - PAGE_NEIGHBOUR_LIMIT : 1)
  const [endPageNumber, setEndPageNumber] = React.useState(pageNumber + PAGE_NEIGHBOUR_LIMIT > maxPageSize ? maxPageSize : pageNumber + PAGE_NEIGHBOUR_LIMIT)
  const { setAlert } = React.useContext(AlertContext)

  // console.log(parseInt(params.get('pageNumber')), parseInt(params.get('pageSize')))
  // console.log(pageNumber, pageSize)
  console.log(startPageNumber, endPageNumber, maxPageSize)
  /**
   * Retrieve the logs from sqlite database
   * @returns {void}
   */
  const retrieveLogs = async () => {
    try {
      const logsResponse = await apis.getLogs(fromDate, toDate, pageNumber, pageSize, verbosity.join(','))
      console.log(logsResponse)
      // logsResponse = logsResponse.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
      // console.log(logsResponse)
      // sort logs based on timestamp

      setLogs(logsResponse.content)
      setMaxLog(logsResponse.totalNumberOfElements)
      // TODO: add backend logic to support max page size
      setMaxPageSize(logsResponse.totalNumberOfPages)
      setEndPageNumber(pageNumber + PAGE_NEIGHBOUR_LIMIT > maxPageSize ? maxPageSize : pageNumber + PAGE_NEIGHBOUR_LIMIT)
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
 * Handles the form's submission and set the logs if any response
 * @param {string} value checked/unchecked item
 * @returns {void}
 */
  const handlePageSizeChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    setPageSize(parseInt(newVal))
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

  /**
     * Render pagination control
     * @returns {JSX.Element} - The pagination component
     */
  const renderPaginationControl = () => (
    <Pagination size="sm">
      <PaginationItem key='a'>
        <PaginationLink
          first
          href={`/log?pageNumber=1&pageSize=${pageSize}`}
        />
      </PaginationItem>
      <PaginationItem key='b'>
        <PaginationLink
          href={`/log?pageNumber=${pageNumber < 1 ? 1 : pageNumber}&pageSize=${pageSize}`}
          previous
        />
      </PaginationItem>
      {pageNumber - PAGE_NEIGHBOUR_LIMIT > 1 ?
        (<PaginationItem key='c' disabled>
          <PaginationLink>
            ...
          </PaginationLink>
        </PaginationItem>
        ) : ""}
      {
        [...Array(endPageNumber - startPageNumber)].map((e, i) => (
          <PaginationItem key={i} active={pageNumber == startPageNumber + i}>
            <PaginationLink
              href={`/log?pageNumber=${startPageNumber + i}&pageSize=${pageSize}`}
            >
              {startPageNumber + i}
            </PaginationLink>
          </PaginationItem>
        ))
      }
      {maxPageSize - pageNumber > PAGE_NEIGHBOUR_LIMIT ?
        (<PaginationItem key='d' disabled>
          <PaginationLink>
            ...
          </PaginationLink>
        </PaginationItem>
        ) : ""}
      <PaginationItem key='e'>
        <PaginationLink
          href={`/log?pageNumber=${pageNumber + 1 > maxPageSize ? maxPageSize : pageNumber + 1}&pageSize=${pageSize}`}
          next
        />
      </PaginationItem>
      <PaginationItem key='f'>
        <PaginationLink
          href={`/log?pageNumber=${maxPageSize}&pageSize=${pageSize}`}
          last
        />
      </PaginationItem>
    </Pagination>
  )

  return (
    <Container fluid>
      <Row>
        {renderPaginationControl()}
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
                    setToDate(date)
                  }}
                  help="default: Current datetime (now)"
                />
              </FormGroup>

              <FormGroup>
                <Label for="pageSizeSelect">Select Page Size</Label>
                <Input type="select" name="select" id="pageSizeSelect" onChange={(value) => handlePageSizeChange(value)} value={pageSize}>
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                  <option>100</option>
                </Input>
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
        <Col>

          <Row>
            {logs && renderLogs(logs.filter((item) => item.message.toLowerCase().includes(filterText)))}
          </Row>
        </Col>
      </Row>

    </Container>
  )
}
export default Log
