import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'console',
  category: 'debug',
  types: ['any', 'time-values', 'setpoint'],
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.north.settings',
    displayProperties: {
      visible: true,
      wrapInBox: false
    },
    enablingConditions: [],
    validators: [],
    attributes: [
      {
        type: 'boolean',
        key: 'verbose',
        translationKey: 'configuration.oibus.manifest.north.console.verbose',
        defaultValue: true,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 3,
          displayInViewMode: true
        }
      }
    ]
  }
};

export default manifest;
