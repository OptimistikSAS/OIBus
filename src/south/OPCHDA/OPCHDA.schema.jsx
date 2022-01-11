import React from 'react'
import { notEmpty, inRange, isPath, minValue, isHost } from '../../services/validation.service'
import validation from '../../client/South/Form/South.validation'

const schema = { name: 'OPCHDA' }
schema.form = {
  AgentSection: {
    type: 'OIbTitle',
    label: 'HDA Agent',
    md: 12,
    children: (
      <>
        <p>
          OPCHDA Agent is an external executable that will handle the protocol HDA. We decided to externalize it to
          avoid combining relatively old librairies in the main OIBus code and also because OPCHDA is only supported on
          Microsoft Windows.
        </p>
        <ul>
          <li>The agent communicate with OIBus using a TCP port that can be configured in this section.</li>
          <li>
            It is possible to decide the level of logs that will be sent by the agent to OIBus. It is recommended to
            start with &apos;debug&apos; and to switch to &apos;info&apos; when the communication is stabilized.
          </li>
          <li>
            By default, when you restart the agent, it will query from the last succesful timestamp (for each scan
            group) so we dont loose values during the time the HDA was not active. if the cache is deleted (or on the
            first startup), the default start time will be the current time except if a key &apos;startTime&apos; (only
            accessible by editing manually the oibus configuration time) indicates a different start time. This feature
            has been added to be allow recovering of values from the past when needed.
          </li>
          <p><b>DA Quality code</b></p>
          <table border="1">
            <tbody>
              <tr>
                <td>
                  0x00000000
                </td>
                <td>
                  Bad [Non-Specific]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000004
                </td>
                <td>
                  Bad [Configuration Error]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000008
                </td>
                <td>
                  Bad [Not Connected]
                </td>
              </tr>
              <tr>
                <td>
                  0x0000000c
                </td>
                <td>
                  Bad [Device Failure]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000010
                </td>
                <td>
                  Bad [Sensor Failure]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000014
                </td>
                <td>
                  Bad [Last Known Value]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000018
                </td>
                <td>
                  Bad [Communication Failure]
                </td>
              </tr>
              <tr>
                <td>
                  0x0000001C
                </td>
                <td>
                  Bad [Out of Service]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000040
                </td>
                <td>
                  Uncertain [Non-Specific]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000041
                </td>
                <td>
                  Uncertain [Non-Specific] (Low Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000042
                </td>
                <td>
                  Uncertain [Non-Specific] (High Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000043
                </td>
                <td>
                  Uncertain [Non-Specific] (Constant)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000044
                </td>
                <td>
                  Uncertain [Last Usable]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000045
                </td>
                <td>
                  Uncertain [Last Usable] (Low Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000046
                </td>
                <td>
                  Uncertain [Last Usable] (High Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000047
                </td>
                <td>
                  Uncertain [Last Usable] (Constant)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000050
                </td>
                <td>
                  Uncertain [Sensor Not Accurate]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000051
                </td>
                <td>
                  Uncertain [Sensor Not Accurate] (Low Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000052
                </td>
                <td>
                  Uncertain [Sensor Not Accurate] (High Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000053
                </td>
                <td>
                  Uncertain [Sensor Not Accurate] (Constant)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000054
                </td>
                <td>
                  Uncertain [EU Exceeded]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000055
                </td>
                <td>
                  Uncertain [EU Exceeded] (Low Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000056
                </td>
                <td>
                  Uncertain [EU Exceeded] (High Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000057
                </td>
                <td>
                  Uncertain [EU Exceeded] (Constant)
                </td>
              </tr>
              <tr>
                <td>
                  0x00000058
                </td>
                <td>
                  Uncertain [Sub-Normal]
                </td>
              </tr>
              <tr>
                <td>
                  0x00000059
                </td>
                <td>
                  Uncertain [Sub-Normal] (Low Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x0000005a
                </td>
                <td>
                  Uncertain [Sub-Normal] (High Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x0000005b
                </td>
                <td>
                  Uncertain [Sub-Normal] (Constant)
                </td>
              </tr>
              <tr>
                <td>
                  0x000000c0
                </td>
                <td>
                  Good [Non-Specific]
                </td>
              </tr>
              <tr>
                <td>
                  0x000000c1
                </td>
                <td>
                  Good [Non-Specific] (Low Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x000000c2
                </td>
                <td>
                  Good [Non-Specific] (High Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x000000c3
                </td>
                <td>
                  Good [Non-Specific] (Constant)
                </td>
              </tr>
              <tr>
                <td>
                  0x000000d8
                </td>
                <td>
                  Good [Local Override]
                </td>
              </tr>
              <tr>
                <td>
                  0x000000d9
                </td>
                <td>
                  Good [Local Override] (Low Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x000000da
                </td>
                <td>
                  Good [Local Override] (High Limited)
                </td>
              </tr>
              <tr>
                <td>
                  0x000000db
                </td>
                <td>
                  Good [Local Override] (Constant)
                </td>
              </tr>
            </tbody>
          </table>
          <p><b>HDA Quality code</b></p>
          <table border="1">
            <tbody>
              <tr>
                <td>
                  0x00010000
                </td>
                <td>
                  Bad [Non-Specific] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00010004
                </td>
                <td>
                  Bad [Configuration Error] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00010008
                </td>
                <td>
                  Bad [Not Connected] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x0001000c
                </td>
                <td>
                  Bad [Device Failure] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00010010
                </td>
                <td>
                  Bad [Sensor Failure] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00010014
                </td>
                <td>
                  Bad [Last Known Value] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00010018
                </td>
                <td>
                  Bad [Communication Failure] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x0001001c
                </td>
                <td>
                  Bad [Out of Service] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00010040
                </td>
                <td>
                  Uncertain [Non-Specific] : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00010041
                </td>
                <td>
                  Uncertain [Non-Specific] (Low Limited) : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00010042
                </td>
                <td>
                  Uncertain [Non-Specific] (High Limited) : Extra Data
                </td>
              </tr>
              <tr>
                <td>
                  0x00040000
                </td>
                <td>
                  Indicates the quality of raw data transmission.
                </td>
              </tr>
              <tr>
                <td>
                  0x00080000
                </td>
                <td>
                  Indicates the quality of calculated data
                  transmission.
                </td>
              </tr>
              <tr>
                <td>
                  0x00100000
                </td>
                <td>
                  No bounding values were found at the starting
                  or ending point.
                </td>
              </tr>
              <tr>
                <td>
                  0x00200000
                </td>
                <td>
                  No raw data were found for the specified time
                  interval.
                </td>
              </tr>
              <tr>
                <td>
                  0x00400000
                </td>
                <td>
                  The raw data in the selected interval were not
                  completely archived.
                </td>
              </tr>
            </tbody>
          </table>
        </ul>
      </>
    ),
  },
  agentFilename: {
    type: 'OIbText',
    valid: isPath(),
    defaultValue: '\\HdaAgent\\HdaAgent.exe',
    help: <div>ex: c:\HdaAgent\HdaAgent.exe</div>,
  },
  tcpPort: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    label: 'TCP Port',
    valid: inRange(1, 65535),
    defaultValue: '2224',
    help: <div>HDA Agent port</div>,
  },
  logLevel: {
    type: 'OIbSelect',
    newRow: false,
    md: 2,
    label: 'Logging Level',
    options: ['silly', 'debug', 'info', 'warning', 'error'],
    defaultValue: 'debug',
    help: <div>Logging Level</div>,
  },
  HDASection: {
    type: 'OIbTitle',
    label: 'HDA Server',
    md: 12,
    children: (
      <>
        <p>
          OPCHDA Server is hosted on the equipment or server on which we want to retrieve values. You need to give the
          host name as well as the HDA server name.
        </p>
        <ul>
          <li>
            The retry interval will be used when the HDA server cant be connected to the HDA Agent to indicate when the
            next retry will occur.
          </li>
          <li>
            Max return values is an OPC HDA parameters allowing to indicate the maximum number of values that can be
            returned in a single read request. Most HDA implementations allows to specify 0 so the maximum is defined by
            the HDA server. Some memory conditions may cause the HDA server to send errors that can be solved by
            minimizing this parameters. A low value requires the server to split a single reply in multiple chunks
            creating more network traffic.
          </li>
          <li>
            Max read interval is used when a query request a very long range (one month for example). The range will be
            divided in smaller request (one hour by default) to avoid the memory issues on the HDA server. This
            parameter is typically used when OIBus was stopped for a long time and that we need to recover values from
            that range on the restart.
          </li>
        </ul>
      </>
    ),
  },
  host: {
    type: 'OIbText',
    defaultValue: 'localhost',
    valid: isHost(),
    help: <div>IP address or hostname of the HDA server</div>,
  },
  serverName: {
    type: 'OIbText',
    newRow: false,
    valid: notEmpty(),
    help: <div>HDA server (Matrikon.OPC.Simulation)</div>,
  },
  retryInterval: {
    type: 'OIbInteger',
    newRow: true,
    md: 2,
    valid: minValue(0),
    defaultValue: 10000,
    help: <div>Retry Interval (ms)</div>,
  },
  maxReturnValues: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 0,
    help: <div>Max return values</div>,
  },
  maxReadInterval: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 3600,
    help: <div>Max read interval (s)</div>,
  },
  scanGroupsSection: {
    type: 'OIbTitle',
    label: 'ScanGroups',
    md: 12,
    children: (
      <p>
        OPCHDA application will request all points in the same scanMode. OPCHDA can query raw values but can also
        aggregate points on a given period. If an aggregate is chosen, the resampling period must also be selected.
        Important: a point with a scanMode without the corresponding scangroup will not be requested.
        <br />
        <b>In the current version, aggregates are NOT supported for production mode. Please use &quot;Raw&quot;</b>
      </p>
    ),
  },
  scanGroups: {
    type: 'OIbTable',
    rows: {
      scanMode: {
        type: 'OIbScanMode',
        label: 'Scan Mode',
        valid: validation.scanMode.isSelectedOnce,
      },
      aggregate: {
        type: 'OIbSelect',
        options: ['Raw', 'Average', 'Minimum', 'Maximum', 'Start', 'End'],
        defaultValue: 'Raw',
      },
      resampling: {
        type: 'OIbSelect',
        options: ['None', 'Minute', 'Hour', 'Day'],
        defaultValue: 'None',
      },
    },
    md: 6,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    unique: true,
    defaultValue: '',
  },
  scanMode: {
    type: 'OIbScanMode',
    help: (
      <div>
        <ul>
          <li>Only scan modes set in scan groups are displayed</li>
          <li>A new scan group must be added to be able to select other scan modes</li>
        </ul>
      </div>
    ),
  },
}

schema.category = 'IoT'

export default schema
