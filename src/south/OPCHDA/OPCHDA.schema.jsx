import React from 'react'
import { notEmpty, inRange, isPath, minValue } from '../../services/validation.service'

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
    type: 'OIbLink',
    defaultValue: 'http://localhost',
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
        aggregate points on a given period. if an aggregate is chosen, the resampling period must also be selected.
        Important: a point with a scanMode without the corresponding scangroup will not be requested
      </p>
    ),
  },
  scanGroups: {
    type: 'OIbTable',
    rows: {
      scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
      Aggregate: {
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
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode' },
}

export default schema
