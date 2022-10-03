import React from 'react'
import { minValue, notEmpty, optional } from '../../services/validation.service'

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
            MQTT host to connect. Make sure you specify the right protocol, host and port number.
            The MQTT client may not get connected if you mention wrong port number or interchange port numbers.
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
            <b>Persistent:</b>
            In this mode the broker will store subscription information, and undelivered messages for the
            client.
            With a non persistent connection the broker does not store any subscription information or
            undelivered messages for the client.
            For this option to take effect QoS must be set to 1 or 2.
            In order for the broker to store session information the engine name is used as MQTT client id .
          </li>
          <li>
            <b>Username:</b>
            Username required by the broker, if any.
          </li>
          <li>
            <b>Password:</b>
            Password required by the broker, if any.
          </li>
          <li>
            <b>Cert File:</b>
            Server certificate used for MQTTS protocol in PEM format.
          </li>
          <li>
            <b>Key File:</b>
            MQTT client private key in PEM format.
          </li>
          <li>
            <b>CA File:</b>
            Certificate Authority file in PEM format. If empty we consider the Cert File as self-signed certificate.
          </li>
          <li>
            <b>Reject Unauthorized:</b>
            In some cases the certificate (CertFile) can not be verified.
            (ex: certificate is self-signed or Certification Authority can not be contacted).
            If Reject Unauthorized is set to false, the connection will still be encrypted but may be vulnerable to man in the middle attacks.
          </li>
          <li>
            <b>Keepalive:</b>
            Set to 0 to disable.
          </li>
          <li>
            <b>Reconnect period:</b>
            Interval between two reconnections. Disable auto reconnect by setting to 0.
          </li>
          <li>
            <b>Connect timout:</b>
            Time to wait before a CONNACK is received.
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
  persistent: {
    type: 'OIbCheckBox',
    md: 1,
    newRow: false,
    defaultValue: false,
  },
  username: {
    type: 'OIbText',
    valid: optional(),
    defaultValue: '',
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    valid: optional(),
    defaultValue: '',
  },
  certFile: {
    type: 'OIbText',
    label: 'Cert File',
    valid: optional(),
    defaultValue: '',
    help: <div>Server certificate (used for MQTTS protocol)</div>,
  },
  keyFile: {
    type: 'OIbText',
    label: 'Key File',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>MQTT client private key</div>,
  },
  caFile: {
    type: 'OIbText',
    label: 'CA File',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>Certificate Authority file (if empty we consider the Cert File as a self-signed certificate)</div>,
  },
  rejectUnauthorized: {
    type: 'OIbCheckBox',
    label: 'Reject Unauthorized Connection',
    defaultValue: false,
  },
  keepalive: {
    type: 'OIbInteger',
    label: 'Keep Alive Interval',
    valid: minValue(0),
    defaultValue: 60000,
  },
  reconnectPeriod: {
    type: 'OIbInteger',
    newRow: false,
    label: 'Reconnect period (ms)',
    valid: minValue(0),
    defaultValue: 1000,
  },
  connectTimeout: {
    type: 'OIbInteger',
    newRow: false,
    label: 'Connect Timeout (ms)',
    valid: minValue(0),
    defaultValue: 30000,
  },
  MqttPayload: {
    type: 'OIbTitle',
    children: (
      <div>
        <ul>
          <li>
            <b>Data array path:</b>
            Optional. If empty, the payload is a simple JSON object. If specified, the JSON contains a JSON
            object array at the specified path.
          </li>
          <li>
            <b>Value path:</b>
            Mandatory. This string is the JSON key path where to find the value (in the array element if
            data array path is specified, or directly in
            the JSON object if not).
          </li>
          <li>
            <b>Node id path:</b>
            Optional. If empty, the nodeId is inferred from the topic. If not empty, this string indicates
            where to find the nodeId value (in the
            array element if data array path is specified, or directly in the JSON object if not).
          </li>
          <li>
            <b>Quality path:</b>
            Mandatory. This string is the JSON key path where to find the quality (in the array element if
            data array path is specified, or directly
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
  pointIdPath: {
    type: 'OIbText',
    defaultValue: '',
    newRow: false,
    valid: optional(),
  },
  qualityPath: {
    type: 'OIbText',
    defaultValue: 'quality',
    newRow: false,
    valid: notEmpty(),
  },
  timestampSettings: {
    type: 'OIbTitle',
    children: (
      <div>
        <p>These parameters describe how to determine the timeStamp</p>
        <ul>
          <li>
            <b>Time Origin:</b>
            If the value is &quot;oibus&quot; the timestamp will be the timestamp for the reception of the
            value by oibus.
            If the value is &quot;payload&quot; the timestamp will be retrieved from the MQTT payload using
            the key specified below.
          </li>
          <li>
            <b>Timestamp Path:</b>
            The string indicates which key in the payload contains the timestamp value. If the payload is an
            array of data, it indicates the key that
            contains the timestamp value in the elements of this array
          </li>
          <li>
            <b>Timestamp Format:</b>
            The string indicates which format to use to parse the timestamp. For example, the
            timestamp &apos;2020-09-16 07:00:00.000&apos; is in the
            format YYYY-MM-DD HH:mm:ss.SSS.
            Another example : if the timestamp is &apos;2020-09-16T07:00:00Z&apos; so the format would be
            YYYY-MM-DDTHH:mm:ssZ.
          </li>
          <li>
            <b>TimeStamp timezone:</b>
            This field indicates in which timezone the timestamp received is. OIBus then converts it into an
            UTC timestamp.
          </li>
        </ul>
      </div>
    ),
  },
  timestampOrigin: {
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
  timestampFormat: {
    type: 'OIbText',
    newRow: false,
    valid: notEmpty(),
    defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
  },
  timestampTimezone: {
    type: 'OIbTimezone',
    newRow: false,
    md: 2,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    unique: true,
    defaultValue: '',
    help: (
      <ul>
        <li>
          Point Id should be unique and it must be checked manually in case of wildcards(# or +)
        </li>
        <li>
          Ex.
          <b> point.# </b>
          covers
          <b> point.id</b>
        </li>
      </ul>
    ),
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

schema.category = 'IoT'

export default schema
