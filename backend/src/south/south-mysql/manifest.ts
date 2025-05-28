import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'mysql',
  category: 'database',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
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
        key: 'throttling',
        translationKey: 'configuration.oibus.manifest.south.mysql.throttling.title',
        displayProperties: {
          visible: true,
          wrapInBox: false
        },
        enablingConditions: [],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        attributes: [
          {
            type: 'number',
            key: 'maxReadInterval',
            translationKey: 'configuration.oibus.manifest.south.mysql.throttling.max-read-interval',
            unit: 's',
            defaultValue: 3600,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'POSITIVE_INTEGER',
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
            type: 'number',
            key: 'readDelay',
            translationKey: 'configuration.oibus.manifest.south.mysql.throttling.read-delay',
            unit: 'ms',
            defaultValue: 200,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'POSITIVE_INTEGER',
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
            type: 'number',
            key: 'overlap',
            translationKey: 'configuration.oibus.manifest.south.mysql.throttling.overlap',
            unit: 'ms',
            defaultValue: 0,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'POSITIVE_INTEGER',
                arguments: []
              }
            ],
            displayProperties: {
              row: 0,
              columns: 4,
              displayInViewMode: true
            }
          }
        ]
      },
      {
        type: 'string',
        key: 'host',
        translationKey: 'configuration.oibus.manifest.south.mysql.host',
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
        translationKey: 'configuration.oibus.manifest.south.mysql.port',
        defaultValue: 3306,
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
        translationKey: 'configuration.oibus.manifest.south.mysql.connection-timeout',
        unit: 'ms',
        defaultValue: 5000,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['100']
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
        translationKey: 'configuration.oibus.manifest.south.mysql.database',
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
        translationKey: 'configuration.oibus.manifest.south.mysql.username',
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
        translationKey: 'configuration.oibus.manifest.south.mysql.password',
        validators: [],
        displayProperties: {
          row: 2,
          columns: 3,
          displayInViewMode: false
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
          key: 'scanModeId',
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
              translationKey: 'configuration.oibus.manifest.south.items.mysql.query',
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
              translationKey: 'configuration.oibus.manifest.south.items.mysql.request-timeout',
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
              type: 'array',
              key: 'dateTimeFields',
              translationKey: 'configuration.oibus.manifest.south.items.mysql.date-time-fields',
              paginate: false,
              numberOfElementPerPage: 0,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'dateTimeField',
                translationKey: 'configuration.oibus.manifest.south.items.mysql.date-time-fields.date-time-field',
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
                    targetPathFromRoot: 'locale',
                    values: ['string']
                  },
                  {
                    referralPathFromRoot: 'type',
                    targetPathFromRoot: 'format',
                    values: ['string']
                  }
                ],
                validators: [],
                attributes: [
                  {
                    type: 'string',
                    key: 'fieldName',
                    translationKey: 'configuration.oibus.manifest.south.items.mysql.date-time-fields.field-name',
                    defaultValue: null,
                    validators: [
                      {
                        type: 'REQUIRED',
                        arguments: []
                      },
                      {
                        type: 'UNIQUE',
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
                    key: 'useAsReference',
                    translationKey: 'configuration.oibus.manifest.south.items.mysql.date-time-fields.use-as-reference',
                    defaultValue: false,
                    validators: [
                      {
                        type: 'REQUIRED',
                        arguments: []
                      },
                      {
                        type: 'SINGLE_TRUE',
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
                    type: 'string-select',
                    key: 'type',
                    translationKey: 'configuration.oibus.manifest.south.items.mysql.date-time-fields.type',
                    defaultValue: 'string',
                    selectableValues: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms', 'date-time'],
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
                    type: 'timezone',
                    key: 'timezone',
                    translationKey: 'configuration.oibus.manifest.south.items.mysql.date-time-fields.timezone',
                    defaultValue: 'UTC',
                    validators: [
                      {
                        type: 'REQUIRED',
                        arguments: []
                      }
                    ],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  },
                  {
                    type: 'string',
                    key: 'format',
                    translationKey: 'configuration.oibus.manifest.south.items.mysql.date-time-fields.format',
                    defaultValue: 'yyyy-MM-dd HH:mm:ss',
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
                    type: 'string',
                    key: 'locale',
                    translationKey: 'configuration.oibus.manifest.south.items.mysql.date-time-fields.locale',
                    defaultValue: 'en-En',
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
                  }
                ]
              }
            },
            {
              type: 'object',
              key: 'serialization',
              translationKey: 'configuration.oibus.manifest.south.items.mysql.serialization.title',
              displayProperties: {
                visible: true,
                wrapInBox: true
              },
              enablingConditions: [],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              attributes: [
                {
                  type: 'string-select',
                  key: 'type',
                  translationKey: 'configuration.oibus.manifest.south.items.mysql.serialization.type',
                  defaultValue: 'csv',
                  selectableValues: ['csv'],
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 0,
                    columns: 2,
                    displayInViewMode: false
                  }
                },
                {
                  type: 'string',
                  key: 'filename',
                  translationKey: 'configuration.oibus.manifest.south.items.mysql.serialization.filename',
                  defaultValue: '@ConnectorName-@ItemName-@CurrentDate.csv',
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 0,
                    columns: 4,
                    displayInViewMode: false
                  }
                },
                {
                  type: 'string-select',
                  key: 'delimiter',
                  translationKey: 'configuration.oibus.manifest.south.items.mysql.serialization.delimiter',
                  defaultValue: 'COMMA',
                  selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
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
                  type: 'boolean',
                  key: 'compression',
                  translationKey: 'configuration.oibus.manifest.south.items.mysql.serialization.compression',
                  defaultValue: false,
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
                  type: 'string',
                  key: 'outputTimestampFormat',
                  translationKey: 'configuration.oibus.manifest.south.items.mysql.serialization.output-timestamp-format',
                  defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 1,
                    columns: 3,
                    displayInViewMode: false
                  }
                },
                {
                  type: 'timezone',
                  key: 'outputTimezone',
                  translationKey: 'configuration.oibus.manifest.south.items.mysql.serialization.output-timezone',
                  defaultValue: 'Europe/Paris',
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 1,
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
  }
};

export default manifest;
