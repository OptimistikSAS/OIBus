import React from 'react'
import { notEmpty, hasLengthBetween } from '../../service/validation.service.js'
import manifest from './manifest.js'

const schema = { ...manifest }
schema.form = {
  RestAPIParameters: {
    type: 'OibTitle',
    label: 'Rest API Settings',
    children: (
      <div>
        <p>
          The aim of this North is to send a batch of data to a Rest Api.
          Using the object mapper, the request body can be converted to match that required by the api.
        </p>
        <ul>
          <li>
            url: url of the Rest Api.
          </li>
          <li>
            Request Method: method wich will be used in the http request.
          </li>
        </ul>
      </div>
    ),
  },
  url: {
    type: 'OibLink',
    label: 'url',
    protocols: ['https', 'http'],
    defaultValue: 'http://localhost:3000',
  },
  requestMethod: {
    type: 'OibSelect',
    label: 'Request method',
    newRow: false,
    options: ['POST', 'PUT', 'PATCH'],
    md: 3,
    defaultValue: 'POST',
  },
  Authentication: {
    type: 'OibTitle',
    label: 'Authentication',
    children: (
      <div>
        <p>
          Authentication headers will be automatically generated. Three types of authentication are supported : Basic, API Key, and Bearer.
        </p>
      </div>
    ),
  },
  authType: {
    type: 'OibSelect',
    md: 2,
    options: ['Basic', 'API Key', 'Bearer'],
    label: 'Authentication Type',
    defaultValue: 'Basic',
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
  secret: {
    type: 'OibPassword',
    label: 'Secret',
    newRow: true,
    valid: hasLengthBetween(0, 256),
    defaultValue: '',
  },
  RHeader: {
    type: 'OibTitle',
    label: 'Request Headers',
  },
  headers: {
    type: 'OibTable',
    rows: {
      key: {
        type: 'OibText',
        newRow: false,
        label: 'Key',
        valid: notEmpty(),
        defaultValue: '',
      },
      value: {
        type: 'OibText',
        newRow: false,
        label: 'Value',
        valid: notEmpty(),
        defaultValue: '',
      },
    },
  },
  ObjMapper: {
    type: 'OibTitle',
    label: 'Object Mapper',
    children: (
      <div>
        <p>
          The object mapper maps the values received from the OIBus engine to a new object.
        </p>
        <p>
          If no object conversion is to be done, enter
          {' '}
          {}
          .
        </p>
      </div>
    ),
  },
  map: {
    md: 12,
    type: 'OibTextArea',
    label: 'Object Mapping',
    contentType: 'json',
    defaultValue: '{}',
    valid: notEmpty(),
  },
}

schema.withAuthType = (authType) => {
  schema.form.user.hidden = authType !== 'Basic'
  schema.form.password.hidden = authType !== 'Basic'
  schema.form.secret.hidden = authType === 'Basic'
  return schema
}

export default schema
