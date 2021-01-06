import React from 'react'
import { notEmpty, optional } from '../../services/validation.service'

const schema = { name: 'MQTT' }
schema.form = {
  MqttSettings: {
    type: 'OIbTitle',
    children: (
      <div>
        <p>This protocol is in restricted release. Please contact Optimistik</p>
        <ul>
          <li>
            <b>Url:</b>
            MQTT host to connect. Make sure you specify right protocol, host and port number.
            MQTT client may not get connected if you mention wrong port number or interchange port numbers.
          </li>
          <li>
            <b>QoS:</b>
            The Quality of Service (QoS) level is an agreement between the sender of a message and the receiver of a message
            that defines the guarantee of delivery for a specific message. There are 3 QoS levels in MQTT:
            <ul>
              <li>At most once (0)</li>
              <li>At least once (1)</li>
              <li>Exactly once (2)</li>
            </ul>
          </li>
          <li>
            <b>Username:</b>
            Username required by broker, if any. MQTT allows to send username for authenticating and authorization of
            client.
          </li>
          <li>
            <b>Password:</b>
            Password required by broker, if any. MQTT allows to send password for authenticating and authorization of
            client.
          </li>
        </ul>
      </div>
    ),
  },
  url: {
    type: 'OIbLink',
    protocols: ['mqtt', 'mqtts', 'tcp', 'tls', 'ws', 'wss'],
    defaultValue: '',
    help: <div>The URL of the MQTT server. The protocol should be one of mqtt, mqtts, tcp, tls, ws, wss</div>,
  },
  qos: {
    type: 'OIbSelect',
    newRow: false,
    md: 1,
    options: [0, 1, 2],
    defaultValue: 1,
  },
  username: {
    type: 'OIbText',
    valid: optional(),
    defaultValue: '',
    help: <div>authorized user</div>,
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>password</div>,
  },
  MqttPayload: {
    type: 'OIbTitle',
    children: (
      <div>
        <ul>
          <li>
            <b>Data array path:</b>
            Optional. If empty, the payload is a simple JSON object. If specified, the JSON contains a JSON object array at the specified path.
          </li>
          <li>
            <b>Value path:</b>
            Mandatory. This string is the JSON key path where to find the value (in the array element if data array path is specified, or directly in
            the JSON object if not).
          </li>
          <li>
            <b>Node id path:</b>
            Optional. If empty, the nodeId is inferred from the topic. If not empty, this string indicates where to find the nodeId value (in the
            array element if data array path is specified, or directly in the JSON object if not).
          </li>
          <li>
            <b>Quality path:</b>
            Mandatory. This string is the JSON key path where to find the quality (in the array element if data array path is specified, or directly
            in the JSON object if not).
          </li>
        </ul>
      </div>
    ),
  },
  dataArrayPath: {
    type: 'OIbText',
    valid: optional(),
  },
  valuePath: {
    type: 'OIbText',
    defaultValue: 'value',
    valid: notEmpty(),
  },
  nodeIdPath: {
    type: 'OIbText',
    defaultValue: 'name',
    newRow: false,
    valid: optional(),
  },
  qualityPath: {
    type: 'OIbText',
    defaultValue: 'quality',
    newRow: false,
    valid: notEmpty(),
  },
  timeStampSettings: {
    type: 'OIbTitle',
    children: (
      <div>
        <p>These parameters describe how to determine the timeStamp</p>
        <ul>
          <li>
            <b>Time Origin:</b>
            If the value is &quot;oibus&quot; the timestamp will be the timestamp for the reception of the value by oibus.
            If the value is &quot;payload&quot; the timestamp will be retrieved from the MQTT payload using the key specified below.
          </li>
          <li>
            <b>TimeStamp Path:</b>
            The string indicates which key in the payload contains the timestamp value. If the payload is an array of data, it indicates the key that
            contains the timestamp value in the elements of this array
          </li>
          <li>
            <b>TimeStamp Format:</b>
            The string indicates which format to use to parse the timestamp. For example, the timestamp &apos;2020-09-16 07:00:00.000&apos; is in the
            format YYYY-MM-DD HH:mm:ss.SSS.
            Another example : if the timestamp is &apos;2020-09-16T07:00:00Z&apos; so the format would be YYYY-MM-DDTHH:mm:ssZ.
          </li>
          <li>
            <b>TimeStamp timezone:</b>
            This field indicates in which timezone the timstamp received is. OIBus then converts it into an UTC timestamp.
          </li>
        </ul>
      </div>
    ),
  },
  timeStampOrigin: {
    type: 'OIbSelect',
    options: ['payload', 'oibus'],
    defaultValue: 'oibus',
  },
  timestampPath: {
    type: 'OIbText',
    newRow: false,
    valid: notEmpty(),
    defaultValue: 'timestamp',
  },
  timeStampFormat: {
    type: 'OIbText',
    newRow: false,
    valid: notEmpty(),
    defaultValue: 'YYYY-MM-DD HH:mm:ss.SSS',
  },
  timeStampTimezone: {
    type: 'OIbTimezone',
    newRow: false,
    md: 2,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: 'listen',
    disabled: true,
    label: 'Scan Mode',
  },
  topic: {
    type: 'OIbText',
    defaultValue: '',
    valid: notEmpty(),
  },
}

export default schema
