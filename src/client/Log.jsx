import React from 'react'
import { FormGroup, FormText, Label, Button, Input, ListGroup, ListGroupItem } from 'reactstrap'
import apis from './services/apis'

const Log = () => {
  const verbosityOptions = ['debug', 'info', 'warning', 'error', 'silly']
  const defaultMaxLog = 50
  const [fromDate, setFromDate] = React.useState()
  const [toDate, setToDate] = React.useState()
  const [verbosity, setVerbosity] = React.useState(verbosityOptions)
  const [logs, setLogs] = React.useState()
  const [filterText, setFilterText] = React.useState('')
  const [maxLog, setMaxLog] = React.useState(defaultMaxLog)

  /**
   * Handles the form's submittion and set the logs if any response
   * @returns {void}
   */
  const handleSubmit = async () => {
    try {
      const logsResponse = await apis.getLogs(fromDate, toDate, verbosity.join(','))
      setLogs(logsResponse)
      setMaxLog(defaultMaxLog)
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Handles the form's submittion and set the logs if any response
   * @param {string} value checked/unchecled item
   * @returns {void}
   */
  const handleVerbosityChange = (value) => {
    if (verbosity.includes(value)) {
      setVerbosity(verbosity.filter(item => item !== value))
    } else {
      setVerbosity([...verbosity, value])
    }
  }

  /**
   * Render the filter options for logs
   * @returns {void}
   */
  const renderFilter = () => (
    <FormGroup>
      <Label for="filterText">Filter</Label>
      <Input
        type="text"
        id="filterText"
        placeholder="message contains..."
        value={filterText}
        onEnded={() => null}
        onChange={(event) => {
          setMaxLog(defaultMaxLog)
          setFilterText(event.target.value.toLowerCase())
        }}
      />
    </FormGroup>
  )

  /**
   * Render the logs
   * @returns {void}
   */
  const renderLogs = () => {
    const filteredLogs = logs.filter((item) => item.message.toLowerCase().includes(filterText))
    return (
      <ListGroup>
        <br />
        {renderFilter()}
        {filteredLogs.filter((_, index) => index < maxLog).map((item) => {
          const { id, level, message, timestamp } = item
          const date = new Date(timestamp)
          return (
            <ListGroupItem key={id}>
              <Label>
                {`${date.toLocaleDateString()} ${date.toLocaleTimeString()}`}
              </Label>
              {` | ${level}| ${message}`}
            </ListGroupItem>
          )
        })}
        {filteredLogs.length > maxLog ? (
          <Button color="primary" onClick={() => setMaxLog(maxLog + defaultMaxLog)}>
            Show more...
          </Button>
        ) : null
        }
        <br />
      </ListGroup>
    )
  }

  const maxDateString = new Date().toISOString().substr(0, 16)
  return (
    <div>
      <FormGroup>
        <Label for="fromDate">From date</Label>
        <Input
          type="datetime-local"
          id="fromDatee"
          max={maxDateString}
          placeholder="yyyy-mm-ddThh:mm:ss+hh:mm"
          required
          onChange={(event) => {
            const date = new Date(event.target.value).toISOString()
            setFromDate(date)
          }}
        />
        <FormText color="muted">
            default: Current datetime - 24 hours (now - 24 hours)
        </FormText>
      </FormGroup>

      <FormGroup>
        <Label for="toDate">To date</Label>
        <Input
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
        <FormText color="muted">
            default: Current datetime (now)
        </FormText>
      </FormGroup>

      <FormGroup>
        <Label for="verbosity">Verbosity</Label>
        {verbosityOptions.map(item => (
          <FormGroup check key={item}>
            <Label check>
              <Input
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
      <Button color="primary" onClick={handleSubmit}>
        Show log
      </Button>
      {logs ? renderLogs() : null}
    </div>
  )
}
export default Log
