import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'slims',
  category: 'api',
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
    enablingConditions: [
      {
        referralPathFromRoot: 'useProxy',
        targetPathFromRoot: 'proxyUrl',
        values: [true]
      },
      {
        referralPathFromRoot: 'useProxy',
        targetPathFromRoot: 'proxyUsername',
        values: [true]
      },
      {
        referralPathFromRoot: 'useProxy',
        targetPathFromRoot: 'proxyPassword',
        values: [true]
      }
    ],
    validators: [],
    attributes: [
      {
        type: 'object',
        key: 'throttling',
        translationKey: 'configuration.oibus.manifest.south.slims.throttling.title',
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
            translationKey: 'configuration.oibus.manifest.south.slims.throttling.max-read-interval',
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
            translationKey: 'configuration.oibus.manifest.south.slims.throttling.read-delay',
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
            translationKey: 'configuration.oibus.manifest.south.slims.throttling.overlap',
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
        key: 'url',
        translationKey: 'configuration.oibus.manifest.south.slims.host',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'PATTERN',
            arguments: ['^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 8,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'port',
        translationKey: 'configuration.oibus.manifest.south.slims.port',
        defaultValue: 80,
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
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'boolean',
        key: 'acceptUnauthorized',
        translationKey: 'configuration.oibus.manifest.south.slims.accept-unauthorized',
        defaultValue: false,
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
        type: 'number',
        key: 'timeout',
        translationKey: 'configuration.oibus.manifest.south.slims.timeout',
        unit: 's',
        defaultValue: 30,
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
          row: 2,
          columns: 6,
          displayInViewMode: false
        }
      },
      {
        type: 'string',
        key: 'username',
        translationKey: 'configuration.oibus.manifest.south.slims.username',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 3,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'password',
        translationKey: 'configuration.oibus.manifest.south.slims.password',
        validators: [],
        displayProperties: {
          row: 3,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'boolean',
        key: 'useProxy',
        translationKey: 'configuration.oibus.manifest.south.slims.use-proxy',
        defaultValue: false,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 4,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'proxyUrl',
        translationKey: 'configuration.oibus.manifest.south.slims.proxy-url',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 4,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'proxyUsername',
        translationKey: 'configuration.oibus.manifest.south.slims.proxy-username',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 4,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'proxyPassword',
        translationKey: 'configuration.oibus.manifest.south.slims.proxy-password',
        validators: [],
        displayProperties: {
          row: 4,
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
              type: 'string',
              key: 'endpoint',
              translationKey: 'configuration.oibus.manifest.south.items.slims.endpoint',
              defaultValue: '/endpoint',
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
              type: 'code',
              key: 'body',
              contentType: 'json',
              translationKey: 'configuration.oibus.manifest.south.items.slims.body',
              defaultValue: null,
              validators: [],
              displayProperties: {
                row: 1,
                columns: 12,
                displayInViewMode: true
              }
            },
            {
              type: 'array',
              key: 'queryParams',
              translationKey: 'configuration.oibus.manifest.south.items.slims.query-params',
              paginate: false,
              numberOfElementPerPage: 0,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'queryParam',
                translationKey: 'configuration.oibus.manifest.south.items.slims.query-params.query-param',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [],
                validators: [],
                attributes: [
                  {
                    type: 'string',
                    key: 'key',
                    translationKey: 'configuration.oibus.manifest.south.items.slims.query-params.key',
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
                    key: 'value',
                    translationKey: 'configuration.oibus.manifest.south.items.slims.query-params.value',
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
                  }
                ]
              }
            },
            {
              type: 'array',
              key: 'dateTimeFields',
              translationKey: 'configuration.oibus.manifest.south.items.slims.date-time-fields',
              paginate: false,
              numberOfElementPerPage: 0,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'dateTimeField',
                translationKey: 'configuration.oibus.manifest.south.items.slims.date-time-fields.date-time-field',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [
                  {
                    referralPathFromRoot: 'type',
                    targetPathFromRoot: 'timezone',
                    values: ['string']
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
                    translationKey: 'configuration.oibus.manifest.south.items.slims.date-time-fields.field-name',
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
                    translationKey: 'configuration.oibus.manifest.south.items.slims.date-time-fields.use-as-reference',
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
                    translationKey: 'configuration.oibus.manifest.south.items.slims.date-time-fields.type',
                    defaultValue: 'string',
                    selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
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
                    translationKey: 'configuration.oibus.manifest.south.items.slims.date-time-fields.timezone',
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
                    translationKey: 'configuration.oibus.manifest.south.items.slims.date-time-fields.format',
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
                    translationKey: 'configuration.oibus.manifest.south.items.slims.date-time-fields.locale',
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
              translationKey: 'configuration.oibus.manifest.south.items.slims.serialization.title',
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
                  translationKey: 'configuration.oibus.manifest.south.items.slims.serialization.type',
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
                  translationKey: 'configuration.oibus.manifest.south.items.slims.serialization.filename',
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
                  translationKey: 'configuration.oibus.manifest.south.items.slims.serialization.delimiter',
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
                  translationKey: 'configuration.oibus.manifest.south.items.slims.serialization.compression',
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
                  translationKey: 'configuration.oibus.manifest.south.items.slims.serialization.output-timestamp-format',
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
                  translationKey: 'configuration.oibus.manifest.south.items.slims.serialization.output-timezone',
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
