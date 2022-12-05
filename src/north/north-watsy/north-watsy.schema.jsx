import React from 'react'
import { notEmpty, hasLengthBetween, inRange } from '../../service/validation.service.js'

const schema = { name: 'WATSYConnect' }
schema.form = {
  WATSYConnectParameters: {
    type: 'OibTitle',
    label: 'WATSY Settings',
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
    type: 'OibTitle',
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
    type: 'OibLink',
    label: 'MQTT URL',
    protocols: ['mqtt', 'mqtts'],
    defaultValue: '',
  },
  port: {
    type: 'OibInteger',
    label: 'Port',
    newRow: false,
    valid: inRange(1, 65535),
    defaultValue: 1883,
  },
  username: {
    type: 'OibText',
    label: 'Username',
    valid: notEmpty(),
    defaultValue: '',
  },
  password: {
    type: 'OibPassword',
    label: 'Password',
    newRow: false,
    valid: hasLengthBetween(0, 256),
    defaultValue: '',
  },
  WebParameters: {
    type: 'OibTitle',
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
    type: 'OibLink',
    label: 'Applicative Host URL',
    protocols: ['http', 'https'],
    defaultValue: '',
  },
  secretKey: {
    type: 'OibPassword',
    label: 'Token',
    newRow: false,
    valid: hasLengthBetween(0, 256),
    defaultValue: '',
  },
}
schema.category = 'API'

export default schema
