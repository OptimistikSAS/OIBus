import React from 'react'
import { notEmpty, optional } from '../../service/validation.service.js'

const schema = { name: 'MQTT' }
schema.form = {
  MQTTParameters: {
    type: 'OibTitle',
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
    type: 'OibLink',
    protocols: ['mqtt', 'mqtts', 'tcp', 'tls', 'ws', 'wss'],
    defaultValue: '',
    help: <div>The URL of the MQTT server. The protocol should be one of mqtt, mqtts, tcp, tls, ws, wss</div>,
  },
  qos: {
    type: 'OibSelect',
    newRow: false,
    md: 1,
    options: [0, 1, 2],
    defaultValue: 1,
  },
  username: {
    type: 'OibText',
    valid: optional(),
    defaultValue: '',
  },
  password: {
    type: 'OibPassword',
    newRow: false,
    valid: optional,
    defaultValue: '',
  },
  certFile: {
    type: 'OibText',
    label: 'Cert File',
    valid: optional(),
    defaultValue: '',
    help: <div>Server certificate (used for MQTTS protocol)</div>,
  },
  keyFile: {
    type: 'OibText',
    newRow: false,
    label: 'Key File',
    valid: optional(),
    defaultValue: '',
    help: <div>MQTT client private key</div>,
  },
  caFile: {
    type: 'OibText',
    newRow: false,
    label: 'CA File',
    valid: optional(),
    defaultValue: '',
    help: <div>Certificate Authority file (if empty we consider the Cert File as a self-signed certificate)</div>,
  },
  rejectUnauthorized: {
    type: 'OibCheckbox',
    label: 'Reject Unauthorized Connection',
    defaultValue: false,
  },
  regExp: {
    type: 'OibText',
    valid: notEmpty(),
    defaultValue: '(.*)',
    help: (
      <div>
        For example (.*)\\/(.
        {2}
        )(.)(.*) to split in 4 groups
      </div>),
  },
  topic: {
    type: 'OibText',
    valid: notEmpty(),
    defaultValue: '%1$s',
    help: <div>Topic value used to publish data to broker MQTT. Topic is based on PointId group part(s) split using Regexp (see help)</div>,
  },
  valueParameters: {
    type: 'OibTitle',
    children: (
      <>
        <p>data value to process by north connector is a Json object which contains :  </p>
        <ul>
          <li>
            value can be a simple data (integer or float or string, etc...) or can be a Json object
          </li>
          <li>
            quality is a string which indicate the quality (good/bad) of value
          </li>
        </ul>
        <p>When value is Json object it can be written in two format: </p>
        <ul>
          <li>
            based on only one level (Json containing keys/values as simple data)
            (example : &lbrace;&ldquo;key1&ldquo;:xxxx, key2:&ldquo;xxxxx&ldquo; ...&rbrace;)
          </li>
          <li>
            based on more than one level (Json containing at min one key/value as Json object)
            (example : &lbrace;&ldquo;key1&ldquo;:&lbrace;jsonObject&rbrace; ...&lbrace;)
          </li>
        </ul>
        <p>To simplify the oibus configuration and to make difference between the formats, presented above, we use two parameters: </p>
        <ul>
          <li>
            useDataKeyValue: boolean value
            <ul>
              <li>
                when checked means we use value key of data Json object (but not the quality key)
              </li>
              <li>
                when unchecked means we use data Json object (value and quality keys)
              </li>
            </ul>
          </li>
        </ul>
        <ul>
          <li>
            keyParentValue: string value
            <ul>
              <li>
                an empty string indicates that Json object is based on a Json with only one level
              </li>
              <li>
                a non empty string indicates the key of Json object based on a Json with more than one level
              </li>
            </ul>
          </li>
        </ul>
      </>
    ),
  },
  useDataKeyValue: {
    type: 'OibCheckbox',
    valid: notEmpty(),
    label: 'use key "value" of Json "data"',
    help: <div>When checked, means that the field &quot;value&quot; will be parsed as JSON object</div>,
    defaultValue: false,
  },
  keyParentValue: {
    type: 'OibText',
    valid: optional(),
    defaultValue: '',
    help: <div>Indicates which field of the JSON object contains the value (empty means the JSON &quot;data&quot; field is used)</div>,
  },
}
schema.category = 'IoT'

export default schema
