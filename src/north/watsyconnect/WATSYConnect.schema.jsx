import React from 'react'
import { notEmpty, hasLengthBetween } from '../../services/validation.service'

const schema = { name: 'WATSYConnect' }
schema.form = {
  WATSYConnectParameters: {
    type: 'OIbTitle',
    label: 'WATSY Connect Parameters',
    children: (
      <div>
        <ul>
          <li>
            <b>MQTT Url: </b>
            Url which will be used in order to process data
          </li>
        </ul>
      </div>
    ),
  },
  MQTTParameters: {
    type: 'OIbTitle',
    label: 'MQTT Authentication',
    children: (
      <div>
        <ul>
          <li>
            <b>MQTT Url: </b>
            Url which will be used in order to process data
          </li>
        </ul>
      </div>
    ),
  },
  MQTTUrl: {
    type: 'OIbLink',
    protocols: ['mqtt', 'mqtts'],
    defaultValue: '',
    help: <div>The URL of the MQTT server. The protocol should be one of mqtt, mqtts </div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    help: <div>The port use for RabbitMQ messages </div>,
  },
  username: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>authorized user to publish in the mqtt URL</div>,
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    valid: hasLengthBetween(0, 256),
    defaultValue: '',
    help: <div>password</div>,
  },
  WebParameters: {
    type: 'OIbTitle',
    label: 'Web Service Authentication',
    children: (
      <div>
        <ul>
          <li>
            <b>HTTP/HTTPS Url: </b>
            Url which will be used in order to process data
          </li>
        </ul>
      </div>
    ),
  },
  applicativeHostUrl: {
    type: 'OIbLink',
    protocols: ['http', 'https'],
    defaultValue: '',
    help: <div>Host URL</div>,
  },
  token: {
    type: 'OIbPassword',
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Host token for connection</div>,
  },
}

export default schema
