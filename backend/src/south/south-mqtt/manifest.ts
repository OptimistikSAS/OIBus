import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'mqtt',
  category: 'iot',
  modes: {
    subscription: true,
    lastPoint: false,
    lastFile: false,
    history: false
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
        referralPathFromRoot: 'qos',
        targetPathFromRoot: 'persistent',
        values: ['1', '2']
      }
    ],
    validators: [],
    attributes: [
      {
        type: 'string',
        key: 'url',
        translationKey: 'configuration.oibus.manifest.south.mqtt.url',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'PATTERN',
            arguments: ['^(mqtt:\\/\\/|mqtts:\\/\\/|tcp:\\/\\/|tls:\\/\\/|ws:\\/\\/|wss:\\/\\/).*']
          }
        ],
        displayProperties: {
          row: 0,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'qos',
        translationKey: 'configuration.oibus.manifest.south.mqtt.qos',
        defaultValue: '1',
        selectableValues: ['0', '1', '2'],
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
        type: 'boolean',
        key: 'persistent',
        translationKey: 'configuration.oibus.manifest.south.mqtt.persistent',
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
        type: 'object',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.title',
        displayProperties: {
          visible: true,
          wrapInBox: false
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
            targetPathFromRoot: 'certFilePath',
            values: ['cert']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'keyFilePath',
            values: ['cert']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'caFilePath',
            values: ['cert']
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
            translationKey: 'configuration.oibus.manifest.south.mqtt.authentication',
            defaultValue: 'none',
            selectableValues: ['none', 'basic', 'cert'],
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
            translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.username',
            defaultValue: null,
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
            type: 'secret',
            key: 'password',
            translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.password',
            validators: [],
            displayProperties: {
              row: 1,
              columns: 4,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'certFilePath',
            translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.cert-file-path',
            defaultValue: null,
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
            key: 'keyFilePath',
            translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.key-file-path',
            defaultValue: null,
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
            key: 'caFilePath',
            translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.ca-file-path',
            defaultValue: null,
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
        type: 'boolean',
        key: 'rejectUnauthorized',
        translationKey: 'configuration.oibus.manifest.south.mqtt.reject-unauthorized',
        defaultValue: false,
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
        key: 'reconnectPeriod',
        translationKey: 'configuration.oibus.manifest.south.mqtt.reconnect-period',
        unit: 'ms',
        defaultValue: 10000,
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
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'connectTimeout',
        translationKey: 'configuration.oibus.manifest.south.mqtt.connect-timeout',
        unit: 'ms',
        defaultValue: 10000,
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
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'maxNumberOfMessages',
        translationKey: 'configuration.oibus.manifest.south.mqtt.max-number-of-messages',
        defaultValue: 1000,
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
            arguments: ['1000000']
          }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'flushMessageTimeout',
        translationKey: 'configuration.oibus.manifest.south.mqtt.flush-message-timeout',
        unit: 'ms',
        defaultValue: 1000,
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
            arguments: ['1000000']
          }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
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
          acceptableType: 'SUBSCRIPTION',
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
            wrapInBox: false
          },
          enablingConditions: [
            {
              referralPathFromRoot: 'valueType',
              targetPathFromRoot: 'jsonPayload',
              values: ['json']
            }
          ],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'topic',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.topic',
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
              type: 'string-select',
              key: 'valueType',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.value-type',
              defaultValue: 'number',
              selectableValues: ['number', 'string', 'json'],
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
              key: 'jsonPayload',
              translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.title',
              displayProperties: {
                visible: true,
                wrapInBox: true
              },
              enablingConditions: [
                {
                  referralPathFromRoot: 'useArray',
                  targetPathFromRoot: 'dataArrayPath',
                  values: [true]
                },
                {
                  referralPathFromRoot: 'pointIdOrigin',
                  targetPathFromRoot: 'pointIdPath',
                  values: ['payload']
                },
                {
                  referralPathFromRoot: 'timestampOrigin',
                  targetPathFromRoot: 'timestampPayload',
                  values: ['payload']
                }
              ],
              validators: [],
              attributes: [
                {
                  type: 'boolean',
                  key: 'useArray',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.use-array',
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
                    displayInViewMode: false
                  }
                },
                {
                  type: 'string',
                  key: 'dataArrayPath',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.data-array-path',
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
                    displayInViewMode: false
                  }
                },
                {
                  type: 'string',
                  key: 'valuePath',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.value-path',
                  defaultValue: null,
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
                  type: 'string-select',
                  key: 'pointIdOrigin',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.point-id-origin',
                  defaultValue: 'oibus',
                  selectableValues: ['oibus', 'payload'],
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
                  type: 'string',
                  key: 'pointIdPath',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.point-id-path',
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
                    displayInViewMode: false
                  }
                },
                {
                  type: 'string-select',
                  key: 'timestampOrigin',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-origin',
                  defaultValue: 'oibus',
                  selectableValues: ['oibus', 'payload'],
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
                  type: 'object',
                  key: 'timestampPayload',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.title',
                  displayProperties: {
                    visible: true,
                    wrapInBox: false
                  },
                  enablingConditions: [
                    {
                      referralPathFromRoot: 'timestampType',
                      targetPathFromRoot: 'timestampFormat',
                      values: ['string']
                    },
                    {
                      referralPathFromRoot: 'timestampType',
                      targetPathFromRoot: 'timezone',
                      values: ['string']
                    }
                  ],
                  validators: [],
                  attributes: [
                    {
                      type: 'string',
                      key: 'timestampPath',
                      translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.timestamp-path',
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
                        displayInViewMode: false
                      }
                    },
                    {
                      type: 'string-select',
                      key: 'timestampType',
                      translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.timestamp-type',
                      defaultValue: 'string',
                      selectableValues: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
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
                      type: 'string',
                      key: 'timestampFormat',
                      translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.timestamp-format',
                      defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
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
                      type: 'timezone',
                      key: 'timezone',
                      translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.timestamp-payload.timezone',
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
                        displayInViewMode: false
                      }
                    }
                  ]
                },
                {
                  type: 'array',
                  key: 'otherFields',
                  translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.other-fields',
                  paginate: false,
                  numberOfElementPerPage: 0,
                  validators: [],
                  rootAttribute: {
                    type: 'object',
                    key: 'otherField',
                    translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.other-fields.title',
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
                        translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.other-fields.name',
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
                        key: 'path',
                        translationKey: 'configuration.oibus.manifest.south.items.mqtt.json-payload.other-fields.path',
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
                          displayInViewMode: false
                        }
                      }
                    ]
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
