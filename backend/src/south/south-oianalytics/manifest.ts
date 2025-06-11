import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'oianalytics',
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
        referralPathFromRoot: 'useOiaModule',
        targetPathFromRoot: 'specificSettings',
        values: [false]
      }
    ],
    validators: [],
    attributes: [
      {
        type: 'object',
        key: 'throttling',
        translationKey: 'configuration.oibus.manifest.south.oianalytics.throttling.title',
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
            translationKey: 'configuration.oibus.manifest.south.oianalytics.throttling.max-read-interval',
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
            translationKey: 'configuration.oibus.manifest.south.oianalytics.throttling.read-delay',
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
            translationKey: 'configuration.oibus.manifest.south.oianalytics.throttling.overlap',
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
        type: 'boolean',
        key: 'useOiaModule',
        translationKey: 'configuration.oibus.manifest.south.oianalytics.use-oia-module',
        defaultValue: true,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
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
        key: 'timeout',
        translationKey: 'configuration.oibus.manifest.south.oianalytics.timeout',
        unit: 's',
        defaultValue: 30,
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
        type: 'object',
        key: 'specificSettings',
        translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.title',
        displayProperties: {
          visible: true,
          wrapInBox: false
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'accessKey',
            values: ['basic']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'secretKey',
            values: ['basic']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'tenantId',
            values: ['aad-client-secret', 'aad-certificate']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'clientId',
            values: ['aad-client-secret', 'aad-certificate']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'clientSecret',
            values: ['aad-client-secret']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'certificateId',
            values: ['aad-certificate']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'scope',
            values: ['aad-certificate']
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
            type: 'string',
            key: 'host',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.host',
            defaultValue: 'https://instance_name.oianalytics.fr',
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
              row: 0,
              columns: 8,
              displayInViewMode: true
            }
          },
          {
            type: 'boolean',
            key: 'acceptUnauthorized',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.accept-unauthorized',
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
            type: 'string-select',
            key: 'authentication',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.authentication',
            defaultValue: 'basic',
            selectableValues: ['basic', 'aad-client-secret', 'aad-certificate'],
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
            type: 'string',
            key: 'accessKey',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.access-key',
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
            type: 'secret',
            key: 'secretKey',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.secret-key',
            validators: [],
            displayProperties: {
              row: 2,
              columns: 6,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'tenantId',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.tenant-id',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'clientId',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.client-id',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'secret',
            key: 'clientSecret',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.client-secret',
            validators: [],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'certificate',
            key: 'certificateId',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.certificate-id',
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'scope',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.scope',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'boolean',
            key: 'useProxy',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.use-proxy',
            defaultValue: false,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 3,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'proxyUrl',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.proxy-url',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 3,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'proxyUsername',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.proxy-username',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 3,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'secret',
            key: 'proxyPassword',
            translationKey: 'configuration.oibus.manifest.south.oianalytics.specific-settings.proxy-password',
            validators: [],
            displayProperties: {
              row: 3,
              columns: 3,
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
              translationKey: 'configuration.oibus.manifest.south.items.oianalytics.endpoint',
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
              type: 'array',
              key: 'queryParams',
              translationKey: 'configuration.oibus.manifest.south.items.oianalytics.query-params',
              paginate: false,
              numberOfElementPerPage: 0,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'queryParam',
                translationKey: 'configuration.oibus.manifest.south.items.oianalytics.query-params.query-param',
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
                    translationKey: 'configuration.oibus.manifest.south.items.oianalytics.query-params.key',
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
                    translationKey: 'configuration.oibus.manifest.south.items.oianalytics.query-params.value',
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
              type: 'object',
              key: 'serialization',
              translationKey: 'configuration.oibus.manifest.south.items.oianalytics.serialization.title',
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
                  translationKey: 'configuration.oibus.manifest.south.items.oianalytics.serialization.type',
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
                  translationKey: 'configuration.oibus.manifest.south.items.oianalytics.serialization.filename',
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
                  translationKey: 'configuration.oibus.manifest.south.items.oianalytics.serialization.delimiter',
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
                  translationKey: 'configuration.oibus.manifest.south.items.oianalytics.serialization.compression',
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
                  translationKey: 'configuration.oibus.manifest.south.items.oianalytics.serialization.output-timestamp-format',
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
                  translationKey: 'configuration.oibus.manifest.south.items.oianalytics.serialization.output-timezone',
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
