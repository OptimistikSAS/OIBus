import React from 'react'
import { FormGroup, FormText, Label, Button, Input, ListGroup, ListGroupItem } from 'reactstrap'
import apis from './services/apis'

const Log = () => {
  const verbosityOptions = ['debug', 'info', 'warning', 'error']
  const defaultMaxLog = 20
  const [fromDate, setFromDate] = React.useState()
  const [toDate, setToDate] = React.useState()
  const [verbosity, setVerbosity] = React.useState(verbosityOptions[0])
  const [logs, setLogs] = React.useState()
  const [filterText, setFilterText] = React.useState('')
  const [maxLog, setMaxLog] = React.useState(defaultMaxLog)

  /**
   * Handles the form's submittion and set the logs if any response
   * @returns {void}
   */
  const handleSubmit = async () => {
    try {
      const logsResponse = await apis.getLogs(fromDate, toDate, verbosity)
      setLogs(logsResponse)
      setMaxLog(defaultMaxLog)
    } catch (error) {
      console.error(error)
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
    const filteredLogs = logs.filter(item => item.message.toLowerCase().includes(filterText))
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
            const date = new Date(event.target.value).getTime()
            setFromDate(date)
          }}
        />
        <FormText color="muted">
            default: Current datetime - 24 hours
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
            const date = new Date(event.target.value).getTime()
            setToDate(date)
          }}
        />
        <FormText color="muted">
            default: Current datetime
        </FormText>
      </FormGroup>

      <FormGroup>
        <Label for="verbosity">Verbosity</Label>
        <Input
          type="select"
          name="verbosity"
          id="verbosity"
          onChange={event => setVerbosity(event.target.value)}
        >
          {verbosityOptions.map(item => <option key={item}>{item}</option>)}
        </Input>
      </FormGroup>
      <Button color="primary" onClick={handleSubmit}>
        Show log
      </Button>
      {logs ? renderLogs() : null}
    </div>
  )
}
export default Log
