import React from 'react'
import { inRange, notEmpty, isAdsNetId } from '../../services/validation.service'

const schema = { name: 'ADS' }
schema.form = {
  AdsSettings: {
    type: 'OIbTitle',
    children: (
      <div>
        <p>TODO</p>
      </div>
    ),
  },
  netId: {
    type: 'OIbText',
    defaultValue: '127.0.0.1.1.1',
    valid: isAdsNetId(),
    help: <div>The ADS net id of the PLC</div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    valid: inRange(1, 65535),
    defaultValue: 851,
    help: <div>Port number of the ADS source</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  address: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: {
    type: 'OIbScanMode',
    label: 'Scan Mode',
  },
}

export default schema
