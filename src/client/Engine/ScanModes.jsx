import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { OIbTitle, OIbText, OIbCron } from '../components/OIbForm'
import { ConfigContext } from '../context/configContext.jsx'
import validation from './Engine.validation'
import utils from '../helpers/utils'

const ScanModes = ({ scanModes }) => {
  const { dispatchNewConfig } = React.useContext(ConfigContext)
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `engine.scanModes.${rowIndex}` })
  }
  const handleAdd = () => {
    dispatchNewConfig({ type: 'addRow', name: 'engine.scanModes', value: { scanMode: '', cronTime: '* * * * * *' } })
  }
  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }
  const existingNames = scanModes.map(({ scanMode }) => scanMode)
  return (
    scanModes && (
      <>
        <OIbTitle label="Scan Modes">
          <>
            <p>
              South protocols scan the dataSources on a regular basis (every minute, every hour, ...). These scan modes needs to be defined in
              this section before they can be used on the various protocols. The syntax is derived from the unix cron syntax with a precision to the
              millisecond.
            </p>
            <p>
              <code>
                &lt;year&gt; &lt;month&gt; &lt;day&gt; &lt;hour&gt; &lt;minute&gt; &lt;second&gt; &lt;millisecond&gt; &lt;microsecond&gt;
              </code>
            </p>
            <p>The table below gives several examples.</p>
            <p>(A special scanMode - listen - needs to be defined for protocols if you have protocols reacting to events mode such as MQTT)</p>
            <div>
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
                    <td>Every 10 minutes</td>
                    <td>* * * * /10</td>
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
            </div>
          </>
        </OIbTitle>
        <Row>
          <Col md={6}>
            <Table
              headers={['scanMode', 'cron']}
              rows={scanModes.map((scanMode, i) => [
                {
                  name: `engine.scanModes.${i}.scanMode`,
                  value: (
                    <OIbText
                      name={`engine.scanModes.${i}.scanMode`}
                      value={scanMode.scanMode}
                      valid={(val) => {
                        const excludedList = existingNames.filter((_, index) => index !== i)
                        return validation.engine.scanModes.scanMode(val, excludedList)
                      }}
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: `engine.scanModes.${i}.cronTime`,
                  value: (
                    <OIbCron
                      name={`engine.scanModes.${i}.cronTime`}
                      value={scanMode.cronTime}
                      valid={validation.engine.scanModes.cronTime}
                      onChange={onChange}
                      help={utils.nextTime(scanMode.cronTime)}
                    />
                  ),
                },
              ])}
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
