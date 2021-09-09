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
            <b>ClientId:</b>
            if ClientId is not empty, MQTT connection will use this text for clientId information.
            If ClientId is empty, MQTT connection will use default clientId information.
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
            <b>CertFile:</b>
            Server certificate : used for mqtts protocol
          </li>
          <li>
            <b>KeyFile:</b>
            Server Public Key : used to decrypt CertFile
          </li>
          <li>
            <b>CAFile:</b>
            Certificate Authority file : if empty we consider CertFile as self-signed certificate.
          </li>
          <li>
            <b>rejectUnauthorized:</b>
            In some cases the certificate (CertFile) can not be verified.
            (ex: certificate is self-signed or Certification Authority can not be contacted).
            No matter if rejectUnauthorized is set to false because connection is crypted.
          </li>
          <li>
            <b>Regexp:</b>
            Regexp will be used to identify token in the pointId that will be used to get data used by MQTT North Connector.
            <ul>
              <li>
                {'(.*)\\/(.{2})(.)(.*) '}
                This example will split into 4 groups: MMMMM/SSNCCC...CC gives %1=MMMMM %2=SS %3=N %4=CCC...CC
              </li>
              <li>
                (.*) This example will split into 1 group: MMMMM/SSNCCC...CC gives %1=MMMMM/SSNCCC...CC
              </li>
            </ul>
          </li>
          <li>
            <b>Topic:</b>
            Topic is used to publish data to broker MQTT.
            Topic value is based on pointId group part(s) splitted using Regexp.
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
  clientId: {
    type: 'OIbText',
    defaultValue: '',
    help: <div>clientId information for mqtt and mqtts connection</div>,
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
  certfile: {
    type: 'OIbText',
    label: 'Cert File',
    defaultValue: '',
    help: <div>Server certificate (used for mqtts protocol)</div>,
  },
  keyfile: {
    type: 'OIbText',
    label: 'Key File',
    defaultValue: '',
    help: <div>Server Public Key (used to decrypt CertFile)</div>,
  },
  cafile: {
    type: 'OIbText',
    label: 'CA File',
    defaultValue: '',
    help: <div>Certificate Authority file (if empty we consider CertFile as self-signed certificates)</div>,
  },
  rejectunauthorized: {
    type: 'OIbCheckBox',
    label: 'reject Unauthorized Connection',
    defaultValue: false,
    help: <div>Accept or not to reject unauthorized connection</div>,
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
    help: 'topic value used to publish data to broker MQTT. Topic is based on PointId group part(s) splitted using Regexp',
  },
}

export default schema
