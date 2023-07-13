import { notEmpty, optional } from '../../service/validation.service.js'
import manifest from './manifest.js'

const schema = { ...manifest }
schema.form = {
  AzureBlobSettings: {
    type: 'OibTitle',
    label: 'Azure Blob Settings',
    md: 12,
  },
  account: {
    type: 'OibText',
    label: 'Account',
    md: 4,
    newRow: true,
    valid: notEmpty(),
    defaultValue: '',
  },
  container: {
    type: 'OibText',
    label: 'Container',
    md: 4,
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
  },
  path: {
    type: 'OibText',
    label: 'Path',
    md: 4,
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
  },
  authentication: {
    type: 'OibSelect',
    label: 'Authentication',
    newRow: true,
    md: 4,
    options: ['external', 'sas', 'aad', 'accessKey'],
    defaultValue: 'sas',
  },
  sasToken: {
    type: 'OibPassword',
    label: 'Shared access signature',
    md: 4,
    newRow: false,
    valid: optional(),
    defaultValue: '',
  },
  accessKey: {
    type: 'OibPassword',
    label: 'Access key',
    newRow: false,
    md: 4,
    valid: optional(),
    defaultValue: '',
  },
  tenantId: {
    type: 'OibText',
    label: 'Tenant id',
    newRow: true,
    md: 4,
    valid: optional(),
    defaultValue: '',
  },
  clientId: {
    type: 'OibText',
    label: 'Client id',
    newRow: false,
    md: 4,
    valid: optional(),
    defaultValue: '',
  },
  clientSecret: {
    type: 'OibPassword',
    label: 'Client password',
    newRow: false,
    md: 4,
    valid: optional(),
    defaultValue: '',
  },
}

export default schema
