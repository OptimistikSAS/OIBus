import React from 'react'
import { notEmpty, inRange, hasLengthBetween } from '../../services/validation.service'

const schema = { name: 'MQTT' }
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
        </ul>
      </div>
    ),
  },
  host: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>MQTT server address</div>,
  },
  port: {
    type: 'OIbText',
    newRow: false,
    valid: inRange(1, 65535),
    defaultValue: 8883,
    help: <div>MQTT server port</div>,
  },
  mqttProtocol: {
    type: 'OIbSelect',
    options: ['mqtt', 'mqtts'],
    label: 'MQTT protocol',
    defaultValue: 'mqtt',
    help: <div>MQTT protocol</div>,
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
}

export default schema
