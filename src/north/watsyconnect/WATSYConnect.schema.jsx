import React from 'react'
import WATSYConnect from './iot.png'
import { notEmpty, hasLengthBetween, inRange } from '../../services/validation.service'

const schema = { name: 'WATSYConnect' }
schema.form = {
  WATSYConnectParameters: {
    type: 'OIbTitle',
    label: 'WATSY Connect Parameters',
    children: (
      <div>
        <ul>
          <li>
            <b>MQTT Parameters: </b>
            Configure Mqtt in order to send WATSY message to your Mqtt url
          </li>
          <li>
            <b>Web Service Parameters: </b>
            Configure your applicative host(url) thanks to: a url and a token. Thanks to it, WATSYConnect
            will be able to send process your data and create loss if it is needed
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
            Url which will be used in order to send messages
          </li>
          <li>
            <b>MQTT Port: </b>
            The port use by RabbitMQ in order to send messages
          </li>
          <li>
            <b>Authentication parameters: </b>
            This paramaters allow WATSYConnect North to connect into mqtt Url thanks to:
            <ul>
              <li>Username</li>
              <li>Password</li>
            </ul>
          </li>
        </ul>
      </div>
    ),
  },
  MQTTUrl: {
    type: 'OIbLink',
    protocols: ['mqtt', 'mqtts'],
    defaultValue: '',
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    valid: inRange(1, 65535),
    defaultValue: 1883,
  },
  username: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    valid: hasLengthBetween(0, 256),
    defaultValue: '',
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
          <li>
            <b>HTTP/HTTPS Token: </b>
            Token which permits to connect into the applicative website
          </li>
        </ul>
      </div>
    ),
  },
  applicativeHostUrl: {
    type: 'OIbLink',
    protocols: ['http', 'https'],
    defaultValue: '',
  },
  secretKey: {
    type: 'OIbPassword',
    label: 'Token',
    newRow: false,
    valid: hasLengthBetween(0, 256),
    defaultValue: '',
  },
}
schema.image = WATSYConnect

export default schema
