import { SouthConnectorManifest } from '../../../shared/model/connector/south-manifest.model';

import { SQL_TABLE_RECORD_FIELDS } from '../sql-table-discovery';

const manifest: SouthConnectorManifest = {
  id: 'oracle',
  category: 'database',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
  },
  explore: true,
  discovery: {
    kind: 'query',
    recordFields: SQL_TABLE_RECORD_FIELDS,
    // The item of each table checked in the Explore modal (see discoverTables())
    defaults: {
      identityKeyFields: ['id'],
      itemFieldMapping: {
        name: '{{name}}',
        'settings.query': '{{query}}',
        'settings.trackingInstant.trackInstant': '{{trackInstant}}',
        'settings.trackingInstant.fieldName': '{{timeColumn}}',
        'settings.trackingInstant.dateTimeInput.type': '{{dateTimeType}}'
      }
    }
  },
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.south.settings',
    displayProperties: {
      visible: true,
      wrapInBox: false
    },
    enablingConditions: [],
    validators: [],
    attributes: [
      {
        type: 'object',
        key: 'connectionSettings',
        translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.title',
        displayProperties: {
          visible: true,
          wrapInBox: true
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'thickMode',
            targetPathFromRoot: 'oracleClient',
            values: [true]
          }
        ],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        attributes: [
          {
            type: 'boolean',
            key: 'thickMode',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.thick-mode',
            defaultValue: false,
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
            key: 'oracleClient',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.oracle-client',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 0,
              columns: 8,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'host',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.host',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 1,
              columns: 6,
              displayInViewMode: true
            }
          },
          {
            type: 'number',
            key: 'port',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.port',
            defaultValue: 1521,
            unit: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'MINIMUM',
                arguments: ['1']
              },
              {
                type: 'MAXIMUM',
                arguments: ['65535']
              }
            ],
            displayProperties: {
              row: 1,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'number',
            key: 'connectionTimeout',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.connection-timeout',
            unit: 'ms',
            defaultValue: 15000,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'MINIMUM',
                arguments: ['0']
              },
              {
                type: 'MAXIMUM',
                arguments: ['30000']
              }
            ],
            displayProperties: {
              row: 1,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'database',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.database',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 2,
              columns: 6,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'username',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.username',
            defaultValue: null,
            validators: [],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'secret',
            key: 'password',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.password',
            validators: [],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: false
            }
          },
          {
            type: 'number',
            key: 'idleTimeout',
            translationKey: 'configuration.oibus.manifest.south.oracle.connection-settings.idle-timeout',
            unit: 'ms',
            defaultValue: 30000,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'MINIMUM',
                arguments: ['1000']
              },
              {
                type: 'MAXIMUM',
                arguments: ['3600000']
              }
            ],
            displayProperties: {
              row: 3,
              columns: 3,
              displayInViewMode: false
            }
          }
        ]
      },
      {
        type: 'number',
        key: 'maxParallelRun',
        translationKey: 'configuration.oibus.manifest.south.oracle.max-parallel-run',
        unit: null,
        defaultValue: 1,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['1']
          },
          {
            type: 'MAXIMUM',
            arguments: ['8']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: true
        }
      }
    ]
  },
  items: {
    type: 'array',
    key: 'items',
    translationKey: 'configuration.oibus.manifest.south.items',
    paginate: true,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'item',
      translationKey: 'configuration.oibus.manifest.south.items.item',
      displayProperties: {
        visible: true,
        wrapInBox: false
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          type: 'string',
          key: 'name',
          translationKey: 'configuration.oibus.manifest.south.items.name',
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
          type: 'boolean',
          key: 'enabled',
          translationKey: 'configuration.oibus.manifest.south.items.enabled',
          defaultValue: true,
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
          type: 'scan-mode',
          key: 'scanMode',
          acceptableType: 'POLL',
          translationKey: 'configuration.oibus.manifest.south.items.scan-mode',
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
          type: 'object',
          key: 'settings',
          translationKey: 'configuration.oibus.manifest.south.items.settings',
          displayProperties: {
            visible: true,
            wrapInBox: true
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'code',
              key: 'query',
              contentType: 'sql',
              translationKey: 'configuration.oibus.manifest.south.items.oracle.query',
              defaultValue:
                'SELECT level, message, timestamp, scope_name as scopeName FROM logs WHERE timestamp > @StartTime AND timestamp <= @EndTime',
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 12,
                displayInViewMode: true
              }
            },
            {
              type: 'number',
              key: 'requestTimeout',
              translationKey: 'configuration.oibus.manifest.south.items.oracle.request-timeout',
              unit: 'ms',
              defaultValue: 15000,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 1,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'object',
              key: 'trackingInstant',
              translationKey: 'configuration.oibus.manifest.south.items.oracle.tracking-instant.title',
              displayProperties: {
                visible: true,
                wrapInBox: true
              },
              enablingConditions: [
                {
                  referralPathFromRoot: 'trackInstant',
                  targetPathFromRoot: 'fieldName',
                  values: [true]
                },
                {
                  referralPathFromRoot: 'trackInstant',
                  targetPathFromRoot: 'dateTimeInput',
                  values: [true]
                }
              ],
              validators: [],
              attributes: [
                {
                  type: 'boolean',
                  key: 'trackInstant',
                  translationKey: 'configuration.oibus.manifest.south.items.oracle.tracking-instant.track-instant',
                  defaultValue: false,
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
                  key: 'fieldName',
                  translationKey: 'configuration.oibus.manifest.south.items.oracle.tracking-instant.field-name',
                  defaultValue: null,
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 0,
                    columns: 8,
                    displayInViewMode: true
                  }
                },
                {
                  type: 'object',
                  key: 'dateTimeInput',
                  translationKey: 'configuration.oibus.manifest.south.items.oracle.tracking-instant.date-time-input.title',
                  displayProperties: {
                    visible: true,
                    wrapInBox: false
                  },
                  enablingConditions: [
                    {
                      referralPathFromRoot: 'type',
                      targetPathFromRoot: 'timezone',
                      values: ['string', 'date-time']
                    },
                    {
                      referralPathFromRoot: 'type',
                      targetPathFromRoot: 'format',
                      values: ['string']
                    },
                    {
                      referralPathFromRoot: 'type',
                      targetPathFromRoot: 'locale',
                      values: ['string']
                    }
                  ],
                  validators: [],
                  attributes: [
                    {
                      type: 'string-select',
                      key: 'type',
                      translationKey: 'configuration.oibus.manifest.south.items.oracle.tracking-instant.date-time-input.type',
                      defaultValue: 'string',
                      selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string', 'date-time'],
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
                    },
                    {
                      type: 'timezone',
                      key: 'timezone',
                      translationKey: 'configuration.oibus.manifest.south.items.oracle.tracking-instant.date-time-input.timezone',
                      defaultValue: 'UTC',
                      validators: [
                        {
                          type: 'REQUIRED',
                          arguments: []
                        }
                      ],
                      displayProperties: {
                        row: 0,
                        columns: 3,
                        displayInViewMode: false
                      }
                    },
                    {
                      type: 'string',
                      key: 'format',
                      translationKey: 'configuration.oibus.manifest.south.items.oracle.tracking-instant.date-time-input.format',
                      defaultValue: 'yyyy-MM-dd HH:mm:ss',
                      validators: [
                        {
                          type: 'REQUIRED',
                          arguments: []
                        }
                      ],
                      displayProperties: {
                        row: 0,
                        columns: 3,
                        displayInViewMode: false
                      }
                    },
                    {
                      type: 'string',
                      key: 'locale',
                      translationKey: 'configuration.oibus.manifest.south.items.oracle.tracking-instant.date-time-input.locale',
                      defaultValue: 'en-En',
                      validators: [
                        {
                          type: 'REQUIRED',
                          arguments: []
                        }
                      ],
                      displayProperties: {
                        row: 0,
                        columns: 3,
                        displayInViewMode: false
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }
};

export default manifest;
