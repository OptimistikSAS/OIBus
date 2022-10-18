import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/table.jsx'
import { OibTitle, OibText, OibCron } from '../components/oib-form'
import { ConfigContext } from '../context/config-context.jsx'
import validation from './engine.validation'
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
        <OibTitle label="Scan Modes">
          <>
            <p>
              South connectors scan the data sources on a regular basis (every minute, every hour, ...). These scan modes needs to be defined in
              this section before they can be used on the various south connectors. The syntax is derived from the unix cron syntax with a
              precision to the millisecond.
            </p>
            <p>
              <code>
                &lt;year&gt; &lt;month&gt; &lt;day&gt; &lt;hour&gt; &lt;minute&gt; &lt;second&gt; &lt;millisecond&gt; &lt;microsecond&gt;
              </code>
            </p>
            <p>The table below gives several examples.</p>
            <p>(A special scanMode - listen - needs to be defined for south connectors if you have protocols reacting to events mode such as MQTT)</p>
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
        </OibTitle>
        <Row>
          <Col md={5}>
            <Table
              headers={['scanMode', 'cron']}
              rows={scanModes.map((scanMode, i) => [
                {
                  name: `engine.scanModes.${i}.scanMode`,
                  value: (
                    <OibText
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
                    <OibCron
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
