import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'mongodb',
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
        type: 'string',
        key: 'connectionString',
        translationKey: 'configuration.oibus.manifest.south.mongodb.connection-string',
        defaultValue: 'mongodb://host1:27017,host2:27017,host3:27017/database?replicaSet=rs0&authSource=admin',
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
        type: 'number',
        key: 'connectionTimeout',
        translationKey: 'configuration.oibus.manifest.south.mongodb.connection-timeout',
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
          row: 0,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'username',
        translationKey: 'configuration.oibus.manifest.south.mongodb.username',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 1,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'password',
        translationKey: 'configuration.oibus.manifest.south.mongodb.password',
        validators: [],
        displayProperties: {
          row: 1,
          columns: 6,
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
              type: 'string',
              key: 'collection',
              translationKey: 'configuration.oibus.manifest.south.items.mongodb.collection',
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
              key: 'queryType',
              translationKey: 'configuration.oibus.manifest.south.items.mongodb.query-type',
              defaultValue: 'find',
              selectableValues: ['find', 'aggregation'],
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
              type: 'code',
              key: 'query',
              contentType: 'json',
              translationKey: 'configuration.oibus.manifest.south.items.mongodb.query',
              defaultValue: '{\n  "timestamp": { "$gt": "@StartTime", "$lte": "@EndTime" }\n}',
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 1,
                columns: 12,
                displayInViewMode: true
              }
            },
            {
              type: 'code',
              key: 'sort',
              contentType: 'json',
              translationKey: 'configuration.oibus.manifest.south.items.mongodb.sort',
              defaultValue: '{ "timestamp": 1 }',
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 2,
                columns: 12,
                displayInViewMode: true
              }
            },
            {
              type: 'object',
              key: 'trackingInstant',
              translationKey: 'configuration.oibus.manifest.south.items.mongodb.tracking-instant.title',
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
                  translationKey: 'configuration.oibus.manifest.south.items.mongodb.tracking-instant.track-instant',
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
                  key: 'jsonPath',
                  translationKey: 'configuration.oibus.manifest.south.items.mongodb.tracking-instant.json-path',
                  defaultValue: '$[*].timestamp',
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
                  translationKey: 'configuration.oibus.manifest.south.items.mongodb.tracking-instant.date-time-input.title',
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
                      translationKey: 'configuration.oibus.manifest.south.items.mongodb.tracking-instant.date-time-input.type',
                      defaultValue: 'timestamp',
                      selectableValues: ['timestamp', 'iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
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
                      translationKey: 'configuration.oibus.manifest.south.items.mongodb.tracking-instant.date-time-input.timezone',
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
                      translationKey: 'configuration.oibus.manifest.south.items.mongodb.tracking-instant.date-time-input.format',
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
                      translationKey: 'configuration.oibus.manifest.south.items.mongodb.tracking-instant.date-time-input.locale',
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
