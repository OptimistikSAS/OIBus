import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'file-writer',
  category: 'file',
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
        type: 'string',
        key: 'outputFolder',
        translationKey: 'configuration.oibus.manifest.north.file-writer.output-folder',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'prefix',
        translationKey: 'configuration.oibus.manifest.north.file-writer.prefix',
        validators: [],
        defaultValue: '@ConnectorName-',
        displayProperties: {
          row: 0,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'suffix',
        translationKey: 'configuration.oibus.manifest.north.file-writer.suffix',
        validators: [],
        defaultValue: '-@CurrentDate',
        displayProperties: {
          row: 0,
          columns: 4,
          displayInViewMode: true
        }
      }
    ]
  }
};
export default manifest;
