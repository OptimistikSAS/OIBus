import React from 'react'
import { notEmpty, hasLengthBetween, optional } from '../../service/validation.service.js'
import manifest from './manifest.js'

const schema = { ...manifest }
schema.form = {
  MongodbParameters: {
    type: 'OibTitle',
    label: 'MongoDB Settings',
    children: (
      <>
        <p>Send points data to MongoDB</p>
        <ul>
          <li>
            <b>Host and Port:</b>
            MongoDB host to connect. Make sure you specify right host and port number depending on MongoDB connection protocol
            you selected.
          </li>
          <li>
            <b>Username:</b>
            Username required by MongoDB server, if any. MongoDB allows to send username for authenticating and authorization of
            client.
          </li>
          <li>
            <b>Password:</b>
            Password required by MongoDB Server, if any. MongoDB allows to send password for authenticating and authorization of
            client.
          </li>
        </ul>
      </>
    ),
  },
  user: {
    type: 'OibText',
    label: 'User',
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
  host: {
    type: 'OibText',
    label: 'Host',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>The host is only the mongoDB server with port separated by &ldquo;:&ldquo; (it not includes mongodb:// protocol)</div>,
  },
  db: {
    type: 'OibText',
    newRow: false,
    label: 'Database',
    valid: notEmpty(),
    defaultValue: '',
  },
  pointIdParameters: {
    type: 'OibTitle',
    label: 'Point ID parameters',
    children: (
      <>
        <p>Regexp will be used to identify token in the pointId that will be used to build the MongoDB query.</p>
        <ul>
          <li>
            {'(.*)\\/(.{2})(.)(.*)'}
            This example will split into 4 groups: MMMMM/SSNCCC...CC gives %1=MMMMM %2=SS %3=N %4=CCC...CC
          </li>
          <li>(.*) This example will split into 1 group: MMMMM/SSNCCC...CC gives %1=MMMMM/SSNCCC...CC</li>
        </ul>
      </>
    ),
  },
  regExp: {
    type: 'OibText',
    label: 'RegExp',
    valid: notEmpty(),
    defaultValue: '(.*)',
    help: (
      <div>
        For example (.*)\\/(.
        {2}
        )(.)(.*) to split in 4 groups
      </div>),
  },
  collection: {
    type: 'OibText',
    label: 'Collection',
    valid: notEmpty(),
    defaultValue: '%1$s',
  },
  indexFields: {
    type: 'OibText',
    label: 'Index fields',
    defaultValue: '',
    valid: hasLengthBetween(0, 256),
    newRow: false,
    help: <div>For example, site:%2$s,unit:%3$s,sensor:%4$s</div>,
  },
  createCollection: {
    type: 'OibCheckbox',
    label: 'Create collection if it does not exist',
    defaultValue: false,
    help: <div>The indexes will also be created</div>,
  },
  timeStampKey: {
    type: 'OibText',
    label: 'Timestamp key',
    valid: notEmpty(),
    newRow: false,
    defaultValue: 'timestamp',
    help: <div>Field in engine data which contain timestamp value</div>,
  },
  valueParameters: {
    type: 'OibTitle',
    label: 'Value parameters',
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
    label: 'Use key "value" of Json "data"',
    help: <div>When checked, means that the field &quot;value&quot; will be parsed as JSON object</div>,
    defaultValue: false,
  },
  keyParentValue: {
    type: 'OibText',
    label: 'Key parent value',
    valid: optional(),
    defaultValue: '',
    help: <div>Indicates which field of the JSON object contains the value (empty means the JSON &quot;data&quot; field is used)</div>,
  },
  timestampPathInDataValue: {
    type: 'OibText',
    label: 'Timestamp path in data value',
    defaultValue: '',
    valid: optional(),
    newRow: false,
    help: <div>Timestamp field extracted from the JSON object (empty means the JSON &quot;timestamp&quot; field is used)</div>,
  },
}

export default schema
