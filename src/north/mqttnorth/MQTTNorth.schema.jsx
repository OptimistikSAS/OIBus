import React from 'react'
import { notEmpty, hasLengthBetween } from '../../services/validation.service'

const schema = { name: 'MQTTNorth' }
schema.form = {
  MQTTParameters: {
    type: 'OIbTitle',
    children: (
      <div>
        <p>MQTT North is in Beta</p>
        <ul>
          <li>
            <b>Protocol:</b>
            Network protocol used by MQTT client to connect with MQTT broker. OIBus supports MQTT, and MQTTS.
          </li>
          <li>
            <b>Host and Port:</b>
            MQTT host to connect. Make sure you specify right host and port number depending on MQTT connection protocol
            you selected. MQTT client may not get connected if you mention wrong port number or interchange port
            numbers.
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
          <li>
            <p>Regexp and Topic:</p>
            Regexp will be used to identify token in the pointId that will be used to build the MQTT topic.
            <ul>
              <li>
                {'(.*)\\/(.{2})(.)(.*)'}
                This example will split into 4 groups: MMMMM/SSNCCC...CC gives %1=MMMMM %2=SS %3=N %4=CCC...CC
              </li>
              <li>(.*) This example will split into 1 group: MMMMM/SSNCCC...CC gives %1=MMMMM/SSNCCC...CC</li>
            </ul>
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
    valid: notEmpty(),
    defaultValue: '',
    help: <div>authorized user</div>,
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    valid: hasLengthBetween(0, 256),
    defaultValue: '',
    help: <div>password</div>,
  },
  regExp: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '(.*)',
    help: 'for example (.*)\\/(.{2})(.)(.*) to split in 4 groups',
  },
  topic: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '%1$s',
  },
}

export default schema
