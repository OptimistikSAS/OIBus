import React from 'react'
import MQTTNorth from './iot.png'
import { notEmpty, optional } from '../../services/validation.service'

const schema = { name: 'MQTTNorth' }
schema.form = {
  MQTTParameters: {
    type: 'OIbTitle',
    children: (
      <div>
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
            <b>ClientId:</b>
            In order for the broker to store session information for a client a client id must be used.
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
            Topic is used to publish data to the MQTT broker.
            The topic value is based on pointId group part(s) split using Regexp. Set the Regexp accordingly.
            <br />
            For example, RegExp
            <b> .* </b>
            and topic
            <b> %1$s </b>
            means that the topic equals the point ID.
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
    valid: optional(),
    defaultValue: '',
    help: <div>clientId information for mqtt and mqtts connection</div>,
  },
  username: {
    type: 'OIbText',
    valid: optional(),
    defaultValue: '',
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    valid: optional,
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
    valid: optional(),
    defaultValue: '',
    help: <div>MQTT client private key</div>,
  },
  caFile: {
    type: 'OIbText',
    label: 'CA File',
    valid: optional(),
    defaultValue: '',
    help: <div>Certificate Authority file (if empty we consider the Cert File as a self-signed certificate)</div>,
  },
  rejectUnauthorized: {
    type: 'OIbCheckBox',
    label: 'Reject Unauthorized Connection',
    defaultValue: false,
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
    help: 'Topic value used to publish data to broker MQTT. Topic is based on PointId group part(s) split using Regexp (see help)',
  },
}
schema.image = MQTTNorth

export default schema
