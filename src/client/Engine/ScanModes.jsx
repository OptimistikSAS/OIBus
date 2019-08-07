import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbTitle, OIbText } from '../components/OIbForm'
import { EngineContext } from '../context/configContext.jsx'

const ScanModes = ({ scanModes }) => {
  const { configDispatch } = React.useContext(EngineContext)
  const handleDelete = (rowIndex) => {
    configDispatch({ type: 'deleteRow', name: 'engine.scanModes', rowIndex })
  }
  const handleAdd = () => {
    configDispatch({ type: 'addRow', name: 'engine.scanModes', value: { scanMode: '', cronTime: '' } })
  }
  const onChange = (name, value, validity) => {
    configDispatch({ type: 'updateEngine', name, value, validity })
  }
  return (
    scanModes && (
      <>
        <OIbTitle title="Scan Modes">
          <>
            <p>
              South protocols can scan the dataSources on a regular basis (every minute, every hour, ...). These scan modes needs to be defined in
              this section before they can be used on the various protocols. The syntax is derived from the unix cron syntax with a precision to the
              millisecond. The table below gives several examples.
            </p>
            <p>A special scanMode - listen - needs to be defined for protocols if you have protocols reacting to events mode such as MQTT</p>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Time expression</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Every hour</td>
                  <td>* * * *</td>
                </tr>
                <tr>
                  <td>Every day at noon</td>
                  <td>* * * 12</td>
                </tr>
                <tr>
                  <td>Every 3th Hour on work days</td>
                  <td>* * w1-5 /3</td>
                </tr>
                <tr>
                  <td>Once at a specific time</td>
                  <td>2014 5 13 18 53 7 300 230</td>
                </tr>
                <tr>
                  <td>Every morning at 7:30 but not on weekends</td>
                  <td>* * !6-7 7 30</td>
                </tr>
                <tr>
                  <td>Every 10 minutes in the day time</td>
                  <td>* * * 8-18 /10</td>
                </tr>
              </tbody>
            </table>
          </>
        </OIbTitle>
        <Row>
          <Col md={6}>
            <Table
              headers={['scanMode', 'cron']}
              rows={scanModes.map((scanMode, i) => [
                {
                  name: `scanModes.${i}.scanMode`,
                  value: (
                    <OIbText
                      name={`scanModes.${i}.scanMode`}
                      value={scanMode.scanMode}
                      regExp={/^.{2,}$/} // i.e. min size = 2
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: `scanModes.${i}.cronTime`,
                  value: (
                    <OIbText
                      name={`scanModes.${i}.cronTime`}
                      value={scanMode.cronTime}
                      regExp={/^.{2,}$/} // i.e. min size = 2
                      onChange={onChange}
                    />
                  ),
                },
              ])}
              onRowClick={() => null}
              handleDelete={handleDelete}
              handleAdd={handleAdd}
            />
          </Col>
        </Row>
      </>
    )
  )
}

ScanModes.propTypes = { scanModes: PropTypes.arrayOf(String).isRequired }

export default ScanModes
