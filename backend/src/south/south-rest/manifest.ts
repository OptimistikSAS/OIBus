import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'rest',
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
    enablingConditions: [],
    validators: [],
    attributes: [
      {
        type: 'object',
        key: 'throttling',
        translationKey: 'configuration.oibus.manifest.south.rest.throttling.title',
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
            translationKey: 'configuration.oibus.manifest.south.rest.throttling.max-read-interval',
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
            translationKey: 'configuration.oibus.manifest.south.rest.throttling.read-delay',
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
            translationKey: 'configuration.oibus.manifest.south.rest.throttling.overlap',
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
        translationKey: 'configuration.oibus.manifest.south.rest.host',
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
        translationKey: 'configuration.oibus.manifest.south.rest.accept-unauthorized',
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
        type: 'number',
        key: 'timeout',
        translationKey: 'configuration.oibus.manifest.south.rest.timeout',
        unit: 's',
        defaultValue: 30,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: false
        }
      },
      {
        type: 'object',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.south.rest.authentication.title',
        displayProperties: {
          visible: true,
          wrapInBox: true
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'username',
            values: ['basic']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'password',
            values: ['basic']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'token',
            values: ['bearer']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'apiKey',
            values: ['api-key']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'apiValue',
            values: ['api-key']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'addTo',
            values: ['api-key']
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
            key: 'type',
            translationKey: 'configuration.oibus.manifest.south.rest.authentication.type',
            defaultValue: 'none',
            selectableValues: ['none', 'basic', 'bearer', 'api-key'],
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
            key: 'username',
            translationKey: 'configuration.oibus.manifest.south.rest.authentication.username',
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
            type: 'secret',
            key: 'password',
            translationKey: 'configuration.oibus.manifest.south.rest.authentication.password',
            validators: [],
            displayProperties: {
              row: 0,
              columns: 4,
              displayInViewMode: true
            }
          },
          {
            type: 'secret',
            key: 'token',
            translationKey: 'configuration.oibus.manifest.south.rest.authentication.token',
            validators: [],
            displayProperties: {
              row: 0,
              columns: 4,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'apiKey',
            translationKey: 'configuration.oibus.manifest.south.rest.authentication.api-key',
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
            type: 'secret',
            key: 'apiValue',
            translationKey: 'configuration.oibus.manifest.south.rest.authentication.api-value',
            validators: [],
            displayProperties: {
              row: 0,
              columns: 4,
              displayInViewMode: true
            }
          },
          {
            type: 'string-select',
            key: 'addTo',
            translationKey: 'configuration.oibus.manifest.south.rest.authentication.add-to',
            defaultValue: 'header',
            selectableValues: ['header', 'query-params'],
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
          }
        ]
      },
      {
        type: 'object',
        key: 'proxy',
        translationKey: 'configuration.oibus.manifest.south.rest.proxy.title',
        displayProperties: {
          visible: true,
          wrapInBox: true
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
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        attributes: [
          {
            type: 'boolean',
            key: 'useProxy',
            translationKey: 'configuration.oibus.manifest.south.rest.proxy.use-proxy',
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
            key: 'proxyUrl',
            translationKey: 'configuration.oibus.manifest.south.rest.proxy.url',
            defaultValue: null,
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
            key: 'proxyUsername',
            translationKey: 'configuration.oibus.manifest.south.rest.proxy.username',
            defaultValue: null,
            validators: [],
            displayProperties: {
              row: 0,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'secret',
            key: 'proxyPassword',
            translationKey: 'configuration.oibus.manifest.south.rest.proxy.password',
            validators: [],
            displayProperties: {
              row: 0,
              columns: 3,
              displayInViewMode: true
            }
          }
        ]
      },
      {
        type: 'object',
        key: 'test',
        translationKey: 'configuration.oibus.manifest.south.rest.test.title',
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
            translationKey: 'configuration.oibus.manifest.south.rest.test.method',
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
            translationKey: 'configuration.oibus.manifest.south.rest.test.endpoint',
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
            translationKey: 'configuration.oibus.manifest.south.rest.test.body',
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
            translationKey: 'configuration.oibus.manifest.south.rest.test.success-code',
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
              targetPathFromRoot: 'trackingInstant',
              values: ['body']
            },
            {
              referralPathFromRoot: 'method',
              targetPathFromRoot: 'body',
              values: ['POST', 'PUT', 'PATCH', 'DELETE']
            }
          ],
          validators: [],
          attributes: [
            {
              type: 'string-select',
              key: 'method',
              translationKey: 'configuration.oibus.manifest.south.items.rest.method',
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
              translationKey: 'configuration.oibus.manifest.south.items.rest.endpoint',
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
              type: 'string-select',
              key: 'returnType',
              translationKey: 'configuration.oibus.manifest.south.items.rest.return-type',
              defaultValue: 'body',
              selectableValues: ['body', 'file'],
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
              type: 'array',
              key: 'queryParams',
              translationKey: 'configuration.oibus.manifest.south.items.rest.query-params',
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
                translationKey: 'configuration.oibus.manifest.south.items.rest.query-params.query-param',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [
                  {
                    referralPathFromRoot: 'value',
                    targetPathFromRoot: 'dateTimeInput',
                    values: ['@StartTime', '@EndTime'],
                    operator: 'CONTAINS'
                  }
                ],
                validators: [],
                attributes: [
                  {
                    type: 'string',
                    key: 'key',
                    translationKey: 'configuration.oibus.manifest.south.items.rest.query-params.key',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest.query-params.value',
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
                    type: 'object',
                    key: 'dateTimeInput',
                    translationKey: 'configuration.oibus.manifest.south.items.rest.date-time-input',
                    displayProperties: {
                      visible: true,
                      wrapInBox: true
                    },
                    enablingConditions: [
                      {
                        referralPathFromRoot: 'type',
                        targetPathFromRoot: 'timezone',
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
                        type: 'string-select',
                        key: 'type',
                        translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.type',
                        defaultValue: 'string',
                        selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                        validators: [],
                        displayProperties: {
                          row: 0,
                          columns: 4,
                          displayInViewMode: true
                        }
                      },
                      {
                        type: 'timezone',
                        key: 'timezone',
                        translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.timezone',
                        defaultValue: 'UTC',
                        validators: [],
                        displayProperties: {
                          row: 0,
                          columns: 4,
                          displayInViewMode: true
                        }
                      },
                      {
                        type: 'string',
                        key: 'format',
                        translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.format',
                        defaultValue: 'yyyy-MM-dd HH:mm:ss',
                        validators: [],
                        displayProperties: {
                          row: 0,
                          columns: 4,
                          displayInViewMode: true
                        }
                      }
                    ]
                  }
                ]
              }
            },
            {
              type: 'array',
              key: 'headers',
              translationKey: 'configuration.oibus.manifest.south.items.rest.headers',
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
                key: 'header',
                translationKey: 'configuration.oibus.manifest.south.items.rest.headers.title',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest.headers.key',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest.headers.value',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.type',
                    defaultValue: 'string',
                    selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
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
                    type: 'timezone',
                    key: 'dateTimeTimezone',
                    translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.timezone',
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
                    translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.format',
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
              type: 'object',
              key: 'body',
              translationKey: 'configuration.oibus.manifest.south.items.rest.body.title',
              displayProperties: {
                visible: true,
                wrapInBox: true
              },
              enablingConditions: [
                {
                  referralPathFromRoot: 'content',
                  targetPathFromRoot: 'dateTimeInput',
                  values: ['@StartTime', '@EndTime'],
                  operator: 'CONTAINS'
                }
              ],
              validators: [],
              attributes: [
                {
                  type: 'code',
                  key: 'content',
                  contentType: 'json',
                  translationKey: 'configuration.oibus.manifest.south.items.rest.body.content',
                  defaultValue: null,
                  validators: [],
                  displayProperties: {
                    row: 0,
                    columns: 12,
                    displayInViewMode: true
                  }
                },
                {
                  type: 'object',
                  key: 'dateTimeInput',
                  translationKey: 'configuration.oibus.manifest.south.items.rest.date-time-input',
                  displayProperties: {
                    visible: true,
                    wrapInBox: true
                  },
                  enablingConditions: [
                    {
                      referralPathFromRoot: 'type',
                      targetPathFromRoot: 'timezone',
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
                      type: 'string-select',
                      key: 'type',
                      translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.type',
                      defaultValue: 'string',
                      selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                      validators: [],
                      displayProperties: {
                        row: 0,
                        columns: 4,
                        displayInViewMode: true
                      }
                    },
                    {
                      type: 'timezone',
                      key: 'timezone',
                      translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.timezone',
                      defaultValue: 'UTC',
                      validators: [],
                      displayProperties: {
                        row: 0,
                        columns: 4,
                        displayInViewMode: true
                      }
                    },
                    {
                      type: 'string',
                      key: 'format',
                      translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.format',
                      defaultValue: 'yyyy-MM-dd HH:mm:ss',
                      validators: [],
                      displayProperties: {
                        row: 0,
                        columns: 4,
                        displayInViewMode: true
                      }
                    }
                  ]
                }
              ]
            },
            {
              type: 'object',
              key: 'trackingInstant',
              translationKey: 'configuration.oibus.manifest.south.items.rest.track-max-instant',
              displayProperties: {
                visible: true,
                wrapInBox: true
              },
              enablingConditions: [
                {
                  referralPathFromRoot: 'trackInstant',
                  targetPathFromRoot: 'jsonPath',
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
                  translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.json-path',
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
                  type: 'string',
                  key: 'jsonPath',
                  translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.json-path',
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
                  translationKey: 'configuration.oibus.manifest.south.items.rest.date-time-input',
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
                      translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.type',
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
                        columns: 3,
                        displayInViewMode: true
                      }
                    },
                    {
                      type: 'timezone',
                      key: 'timezone',
                      translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.timezone',
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
                        displayInViewMode: true
                      }
                    },
                    {
                      type: 'string',
                      key: 'format',
                      translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.format',
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
                      translationKey: 'configuration.oibus.manifest.south.items.rest.date-time.locale',
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
