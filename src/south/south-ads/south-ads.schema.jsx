import React from 'react'
import { inRange, optional, notEmpty, minValue } from '../../service/validation.service.js'

// eslint-disable-next-line max-len
const adsNetId = /^\s*((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))\s*$/
const isAdsNetId = (name = 'Value') => (val) => (
  adsNetId.test(val) ? null : `${name} should be a valid ads net ip`
)

const schema = { name: 'ADS' }
schema.form = {
  AdsSettings: {
    type: 'OibTitle',
    label: 'ADS Settings',
    children: (
      <div>
        <p>
          ADS is a protocol used with TwinCAT to communicate with Beckhoff PLCs.
          <br />
          The ADS protocol communicates with an AMS router which then transmits messages to the PLC with the correct
          protocol.
        </p>
        <p>
          When OIBus is installed on the same machine than the AMS router, only the Net Id and Port must be set.
          <br />
          The ADS protocol will look by default to localhost for AMS router and automatically set client ams net id and port.
        </p>
        <p>
          When OIBus is installed in a distant machine (physical or virtual), the address of the AMS router and its port must be set.
          By default, AMS router port is 48898.
        </p>
        <p>
          The client ams net id must be set beforehand.
          See the official
          {' '}
          <a href="https://optimistik.fr/oibus/" rel="noreferrer" target="_blank">OIBus</a>
          {' '}
          documentation for more information.
        </p>
      </div>
    ),
  },
  netId: {
    type: 'OibText',
    label: 'Net ID',
    defaultValue: '127.0.0.1.1.1',
    valid: isAdsNetId(),
    help: <div>The ADS net id of the PLC</div>,
  },
  port: {
    type: 'OibInteger',
    label: 'Port',
    newRow: false,
    valid: inRange(1, 65535),
    defaultValue: 851,
    help: <div>Port number of the ADS source</div>,
  },

  routerAddress: {
    type: 'OibText',
    label: 'Router address',
    valid: optional(),
    help: <div>The IP address where the AMS router is</div>,
  },
  routerTcpPort: {
    type: 'OibInteger',
    label: 'Router TCP port',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>Port number of the AMS router</div>,
  },

  clientAmsNetId: {
    type: 'OibText',
    label: 'AMS Net ID',
    valid: optional(),
    help: <div>The AMS Net ID set to this client from the AMS router settings</div>,
  },
  clientAdsPort: {
    type: 'OibInteger',
    label: 'ADS Client port',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>Port number that will be set for this client (must be unused on the server side)</div>,
  },

  retryInterval: {
    type: 'OibInteger',
    label: 'Retry interval (ms)',
    newRow: true,
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
  },

  AdsDataSettings: {
    type: 'OibTitle',
    label: 'ADS Data Settings',
    children: (
      <div>
        <ul>
          <li>
            <b>PLC name:</b>
            You can add a prefix to your points ID by mentioning your PLC name. To separate this name from your points
            ID, you can add a separator.
            {' '}
            <br />
            For example, if you have a point ID TEST.MY_INTEGER and that I want to add something in front of it
            to better identify the data, you can add MY_PLC. in front of your point (dot included).
            That will give you MY_PLC.TEST.MY_INTEGER
            <br />
            Note that the PLC name is not used to request the point on the PLC, but is added to the pointId that will be send to your north connector.
          </li>
          <li>
            <b>Enumeration value:</b>
            In case of enumeration data, tell OIBus how to take into account the type of the value: text or integer.
            Here is an Enumeration example :
            <ul>
              <li>Disabled: 0</li>
              <li>Starting: 50</li>
              <li>Running: 100</li>
              <li>Stopping: 200</li>
            </ul>
            The Text option will take the following values : Disabled, Starting, Running or Stopping.
            The Integer option will take the following values : 0, 50, 100 or 200.
          </li>
          <li>
            <b>Boolean value:</b>
            In case of boolean data, tell OIBus how to take into account the type of the value: text or integer.
            <ul>
              <li>false or 0</li>
              <li>true or 1</li>
            </ul>
          </li>
        </ul>
      </div>
    ),
  },
  plcName: {
    type: 'OibText',
    label: 'PLC name',
    defaultValue: '',
    valid: optional(),
    help: <div>The name of the PLC that will be added to the points ID as prefix.</div>,
  },
  enumAsText: {
    type: 'OibSelect',
    defaultValue: 'Integer',
    options: ['Text', 'Integer'],
    label: 'Enumeration value',
  },
  boolAsText: {
    type: 'OibSelect',
    newRow: false,
    defaultValue: 'Integer',
    options: ['Text', 'Integer'],
    label: 'Boolean value',
  },
  AdsStructures: {
    type: 'OibTitle',
    label: 'ADS structures',
    children: (
      <div>
        Only specified structures will be taken into account. To take all fields of a structure, you can use the wildcard *.
        To take some of the fields only, specify them (case sensitive), separated by commas.
        For example, E_ANA is the name of the structure, and the fields to take are : Mesure,a,b
      </div>
    ),
  },
  structureFiltering: {
    type: 'OibTable',
    rows: {
      name: {
        type: 'OibText',
        newRow: false,
        label: 'Name',
        valid: notEmpty(),
        defaultValue: '',
      },
      fields: {
        type: 'OibText',
        newRow: false,
        label: 'Fields',
        valid: notEmpty(),
        defaultValue: '',
      },
    },
  },
}

schema.points = {
  pointId: {
    type: 'OibText',
    label: 'Point ID',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: {
    type: 'OibScanMode',
    label: 'Scan Mode',
  },
}
schema.category = 'IoT'

export default schema
