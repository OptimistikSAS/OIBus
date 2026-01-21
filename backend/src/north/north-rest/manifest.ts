import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'rest',
  category: 'file',
  types: ['any', 'time-values'],
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
        key: 'host',
        translationKey: 'configuration.oibus.manifest.north.rest.host',
        defaultValue: 'https://instance_name.fr',
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
        translationKey: 'configuration.oibus.manifest.north.rest.accept-unauthorized',
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
        key: 'method',
        translationKey: 'configuration.oibus.manifest.north.rest.method',
        defaultValue: 'GET',
        selectableValues: ['POST', 'PUT', 'PATCH'],
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
        type: 'string',
        key: 'endpoint',
        translationKey: 'configuration.oibus.manifest.north.rest.endpoint',
        defaultValue: '/api/data',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 9,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'timeout',
        translationKey: 'configuration.oibus.manifest.north.rest.timeout',
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
          columns: 4,
          displayInViewMode: false
        }
      },
      {
        type: 'string-select',
        key: 'sendAs',
        translationKey: 'configuration.oibus.manifest.north.rest.send-as',
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
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'successCode',
        translationKey: 'configuration.oibus.manifest.north.rest.success-code',
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
          displayInViewMode: false
        }
      },
      {
        type: 'object',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.north.rest.authentication.title',
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
            translationKey: 'configuration.oibus.manifest.north.rest.authentication.type',
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
            translationKey: 'configuration.oibus.manifest.north.rest.authentication.username',
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
            translationKey: 'configuration.oibus.manifest.north.rest.authentication.password',
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
            translationKey: 'configuration.oibus.manifest.north.rest.authentication.token',
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
            translationKey: 'configuration.oibus.manifest.north.rest.authentication.api-key',
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
            translationKey: 'configuration.oibus.manifest.north.rest.authentication.api-value',
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
            translationKey: 'configuration.oibus.manifest.north.rest.authentication.add-to',
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
        translationKey: 'configuration.oibus.manifest.north.rest.proxy.title',
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
            translationKey: 'configuration.oibus.manifest.north.rest.proxy.use-proxy',
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
            translationKey: 'configuration.oibus.manifest.north.rest.proxy.url',
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
            translationKey: 'configuration.oibus.manifest.north.rest.proxy.username',
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
            translationKey: 'configuration.oibus.manifest.north.rest.proxy.password',
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
        type: 'array',
        key: 'queryParams',
        translationKey: 'configuration.oibus.manifest.north.rest.query-params',
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
          translationKey: 'configuration.oibus.manifest.north.rest.query-params.query-param',
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
              translationKey: 'configuration.oibus.manifest.north.rest.query-params.key',
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
              translationKey: 'configuration.oibus.manifest.north.rest.query-params.value',
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
            }
          ]
        }
      },
      {
        type: 'array',
        key: 'headers',
        translationKey: 'configuration.oibus.manifest.north.rest.headers',
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
          translationKey: 'configuration.oibus.manifest.north.rest.headers.title',
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
              translationKey: 'configuration.oibus.manifest.north.rest.headers.key',
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
              translationKey: 'configuration.oibus.manifest.north.rest.headers.value',
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
            }
          ]
        }
      },
      {
        type: 'object',
        key: 'test',
        translationKey: 'configuration.oibus.manifest.north.rest.test.title',
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
            key: 'testMethod',
            translationKey: 'configuration.oibus.manifest.north.rest.test.method',
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
            key: 'testEndpoint',
            translationKey: 'configuration.oibus.manifest.north.rest.test.endpoint',
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
            translationKey: 'configuration.oibus.manifest.north.rest.test.body',
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
            key: 'testSuccessCode',
            translationKey: 'configuration.oibus.manifest.north.rest.test.success-code',
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
  }
};

export default manifest;
