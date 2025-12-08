import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'rest-api',
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
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'username',
        values: ['basic']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'password',
        values: ['basic']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'token',
        values: ['bearer']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'apiKey',
        values: ['api-key']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'apiValue',
        values: ['api-key']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'addTo',
        values: ['api-key']
      },
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
        translationKey: 'configuration.oibus.manifest.south.rest-api.throttling.title',
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
            translationKey: 'configuration.oibus.manifest.south.rest-api.throttling.max-read-interval',
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
            translationKey: 'configuration.oibus.manifest.south.rest-api.throttling.read-delay',
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
            translationKey: 'configuration.oibus.manifest.south.rest-api.throttling.overlap',
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
        translationKey: 'configuration.oibus.manifest.south.rest-api.host',
        defaultValue: 'http://server.com:8080',
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
        type: 'boolean',
        key: 'acceptUnauthorized',
        translationKey: 'configuration.oibus.manifest.south.rest-api.accept-unauthorized',
        defaultValue: false,
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
        type: 'string-select',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.south.rest-api.authentication',
        defaultValue: 'none',
        selectableValues: ['none', 'basic', 'bearer', 'api-key'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'username',
        translationKey: 'configuration.oibus.manifest.south.rest-api.username',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'password',
        translationKey: 'configuration.oibus.manifest.south.rest-api.password',
        validators: [],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'token',
        translationKey: 'configuration.oibus.manifest.south.rest-api.token',
        validators: [],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'apiKey',
        translationKey: 'configuration.oibus.manifest.south.rest-api.api-key',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'apiValue',
        translationKey: 'configuration.oibus.manifest.south.rest-api.api-value',
        validators: [],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'addTo',
        translationKey: 'configuration.oibus.manifest.south.rest-api.add-to',
        defaultValue: 'header',
        selectableValues: ['header', 'query-params'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'object',
        key: 'test',
        translationKey: 'configuration.oibus.manifest.south.rest-api.test.title',
        displayProperties: {
          visible: true,
          wrapInBox: true
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'method',
            targetPathFromRoot: 'body',
            values: ['POST', 'PUT']
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
            type: 'string-select',
            key: 'method',
            translationKey: 'configuration.oibus.manifest.south.rest-api.test.method',
            defaultValue: 'GET',
            selectableValues: ['GET', 'POST', 'PUT'],
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
            key: 'endpoint',
            translationKey: 'configuration.oibus.manifest.south.rest-api.test.endpoint',
            defaultValue: '/',
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
            type: 'code',
            key: 'body',
            contentType: 'json',
            translationKey: 'configuration.oibus.manifest.south.rest-api.test.body',
            defaultValue: null,
            validators: [],
            displayProperties: {
              row: 1,
              columns: 12,
              displayInViewMode: true
            }
          },
          {
            type: 'number',
            key: 'successCode',
            translationKey: 'configuration.oibus.manifest.south.rest-api.test.success-code',
            unit: '',
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
              row: 2,
              columns: 4,
              displayInViewMode: true
            }
          }
        ]
      },
      {
        type: 'number',
        key: 'timeout',
        translationKey: 'configuration.oibus.manifest.south.rest-api.timeout',
        unit: 's',
        defaultValue: 30,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: false
        }
      },
      {
        type: 'boolean',
        key: 'useProxy',
        translationKey: 'configuration.oibus.manifest.south.rest-api.use-proxy',
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
        translationKey: 'configuration.oibus.manifest.south.rest-api.proxy-url',
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
        translationKey: 'configuration.oibus.manifest.south.rest-api.proxy-username',
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
        translationKey: 'configuration.oibus.manifest.south.rest-api.proxy-password',
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
          enablingConditions: [
            {
              referralPathFromRoot: 'returnType',
              targetPathFromRoot: 'dateTimeFields',
              values: ['body']
            },
            {
              referralPathFromRoot: 'returnType',
              targetPathFromRoot: 'serialization',
              values: ['body']
            },
            {
              referralPathFromRoot: 'method',
              targetPathFromRoot: 'body',
              values: ['POST', 'PUT', 'PATCH', 'DELETE']
            },
            {
              referralPathFromRoot: 'body',
              targetPathFromRoot: 'bodyDateTimeType',
              values: ['@StartTime', '@EndTime'],
              operator: 'CONTAINS'
            },
            {
              referralPathFromRoot: 'bodyDateTimeType',
              targetPathFromRoot: 'bodyDateTimeTimezone',
              values: ['string']
            },
            {
              referralPathFromRoot: 'body',
              targetPathFromRoot: 'bodyDateTimeTimezone',
              values: ['@StartTime', '@EndTime'],
              operator: 'CONTAINS'
            },
            {
              referralPathFromRoot: 'bodyDateTimeType',
              targetPathFromRoot: 'bodyDateTimeFormat',
              values: ['string']
            },
            {
              referralPathFromRoot: 'body',
              targetPathFromRoot: 'bodyDateTimeFormat',
              values: ['@StartTime', '@EndTime'],
              operator: 'CONTAINS'
            }
          ],
          validators: [],
          attributes: [
            {
              type: 'string-select',
              key: 'method',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.method',
              defaultValue: 'GET',
              selectableValues: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
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
              key: 'endpoint',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.endpoint',
              defaultValue: '/api/data',
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 9,
                displayInViewMode: true
              }
            },
            {
              type: 'array',
              key: 'queryParams',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.query-params',
              paginate: false,
              numberOfElementPerPage: 0,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              rootAttribute: {
                type: 'object',
                key: 'queryParam',
                translationKey: 'configuration.oibus.manifest.south.items.rest-api.query-params.query-param',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [
                  {
                    referralPathFromRoot: 'value',
                    targetPathFromRoot: 'dateTimeType',
                    values: ['@StartTime', '@EndTime'],
                    operator: 'CONTAINS'
                  },
                  {
                    referralPathFromRoot: 'dateTimeType',
                    targetPathFromRoot: 'dateTimeTimezone',
                    values: ['string']
                  },
                  {
                    referralPathFromRoot: 'value',
                    targetPathFromRoot: 'dateTimeTimezone',
                    values: ['@StartTime', '@EndTime'],
                    operator: 'CONTAINS'
                  },
                  {
                    referralPathFromRoot: 'dateTimeType',
                    targetPathFromRoot: 'dateTimeFormat',
                    values: ['string']
                  },
                  {
                    referralPathFromRoot: 'value',
                    targetPathFromRoot: 'dateTimeFormat',
                    values: ['@StartTime', '@EndTime'],
                    operator: 'CONTAINS'
                  }
                ],
                validators: [],
                attributes: [
                  {
                    type: 'string',
                    key: 'key',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.query-params.key',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.query-params.value',
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
                    type: 'string-select',
                    key: 'dateTimeType',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.type',
                    defaultValue: 'iso-string',
                    selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                    validators: [],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  },
                  {
                    type: 'timezone',
                    key: 'dateTimeTimezone',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.timezone',
                    defaultValue: 'UTC',
                    validators: [],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  },
                  {
                    type: 'string',
                    key: 'dateTimeFormat',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.format',
                    defaultValue: 'yyyy-MM-dd HH:mm:ss',
                    validators: [],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  }
                ]
              }
            },
            {
              type: 'code',
              key: 'body',
              contentType: 'json',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.body',
              defaultValue: null,
              validators: [],
              displayProperties: {
                row: 2,
                columns: 12,
                displayInViewMode: true
              }
            },
            {
              type: 'string-select',
              key: 'bodyDateTimeType',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.type',
              defaultValue: 'iso-string',
              selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
              validators: [],
              displayProperties: {
                row: 3,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'timezone',
              key: 'bodyDateTimeTimezone',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.timezone',
              defaultValue: 'UTC',
              validators: [],
              displayProperties: {
                row: 3,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string',
              key: 'bodyDateTimeFormat',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.format',
              defaultValue: 'yyyy-MM-dd HH:mm:ss',
              validators: [],
              displayProperties: {
                row: 3,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'array',
              key: 'headers',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.headers',
              paginate: false,
              numberOfElementPerPage: 0,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'header',
                translationKey: 'configuration.oibus.manifest.south.items.rest-api.headers.header',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [
                  {
                    referralPathFromRoot: 'value',
                    targetPathFromRoot: 'dateTimeType',
                    values: ['@StartTime', '@EndTime'],
                    operator: 'CONTAINS'
                  },
                  {
                    referralPathFromRoot: 'dateTimeType',
                    targetPathFromRoot: 'dateTimeTimezone',
                    values: ['string']
                  },
                  {
                    referralPathFromRoot: 'value',
                    targetPathFromRoot: 'dateTimeTimezone',
                    values: ['@StartTime', '@EndTime'],
                    operator: 'CONTAINS'
                  },
                  {
                    referralPathFromRoot: 'dateTimeType',
                    targetPathFromRoot: 'dateTimeFormat',
                    values: ['string']
                  },
                  {
                    referralPathFromRoot: 'value',
                    targetPathFromRoot: 'dateTimeFormat',
                    values: ['@StartTime', '@EndTime'],
                    operator: 'CONTAINS'
                  }
                ],
                validators: [],
                attributes: [
                  {
                    type: 'string',
                    key: 'key',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.headers.key',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.headers.value',
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
                    type: 'string-select',
                    key: 'dateTimeType',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.type',
                    defaultValue: 'iso-string',
                    selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                    validators: [],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  },
                  {
                    type: 'timezone',
                    key: 'dateTimeTimezone',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.timezone',
                    defaultValue: 'UTC',
                    validators: [],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  },
                  {
                    type: 'string',
                    key: 'dateTimeFormat',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.format',
                    defaultValue: 'yyyy-MM-dd HH:mm:ss',
                    validators: [],
                    displayProperties: {
                      row: 1,
                      columns: 4,
                      displayInViewMode: true
                    }
                  }
                ]
              }
            },
            {
              type: 'string-select',
              key: 'returnType',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.return-type',
              defaultValue: 'body',
              selectableValues: ['body', 'file'],
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
              type: 'array',
              key: 'dateTimeFields',
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields',
              paginate: false,
              numberOfElementPerPage: 0,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'dateTimeField',
                translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.date-time-field',
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
                    key: 'jsonPath',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.json-path',
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
                    key: 'fieldName',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.field-name',
                    defaultValue: null,
                    validators: [],
                    displayProperties: {
                      row: 0,
                      columns: 4,
                      displayInViewMode: true
                    }
                  },
                  {
                    type: 'boolean',
                    key: 'useAsReference',
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.use-as-reference',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.type',
                    defaultValue: 'iso-string',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.timezone',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.format',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest-api.date-time-fields.locale',
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
              translationKey: 'configuration.oibus.manifest.south.items.rest-api.serialization.title',
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
                  translationKey: 'configuration.oibus.manifest.south.items.rest-api.serialization.type',
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
                  translationKey: 'configuration.oibus.manifest.south.items.rest-api.serialization.filename',
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
                  translationKey: 'configuration.oibus.manifest.south.items.rest-api.serialization.delimiter',
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
                  translationKey: 'configuration.oibus.manifest.south.items.rest-api.serialization.compression',
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
                  translationKey: 'configuration.oibus.manifest.south.items.rest-api.serialization.output-timestamp-format',
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
                  translationKey: 'configuration.oibus.manifest.south.items.rest-api.serialization.output-timezone',
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
