import { TestBed } from '@angular/core/testing';

import { EditSouthComponent } from './edit-south.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ScanModeService } from '../../services/scan-mode.service';
import { provideHttpClient } from '@angular/common/http';
import { SouthConnectorDTO, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CertificateService } from '../../services/certificate.service';

class EditSouthComponentTester extends ComponentTester<EditSouthComponent> {
  constructor() {
    super(EditSouthComponent);
  }

  get title() {
    return this.element('h1');
  }

  get name() {
    return this.input('#south-name');
  }

  get enabled() {
    return this.input('#south-enabled');
  }

  get maxInstant() {
    return this.input('#south-max-instant-per-item')!;
  }

  get description() {
    return this.input('#south-description');
  }

  get specificTitle() {
    return this.element('#specific-settings-title');
  }

  get specificForm() {
    return this.element(OIBusObjectFormControlComponent);
  }
}

describe('EditSouthComponent', () => {
  let tester: EditSouthComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let certificateService: jasmine.SpyObj<CertificateService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService }
      ]
    });

    scanModeService.list.and.returnValue(of([]));
    certificateService.list.and.returnValue(of([]));

    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(testData.south.manifest));
  });

  describe('create mode', () => {
    beforeEach(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: stubRoute({ queryParams: { type: 'SQL' } })
      });

      tester = new EditSouthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      expect(tester.title).toContainText('Create Folder scanner south connector');
      expect(tester.enabled).toBeChecked();
      expect(tester.description).toHaveValue('');
      expect(tester.specificForm).toBeDefined();

      expect(scanModeService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit mode', () => {
    const southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> = {
      id: 'id1',
      type: 'mssql',
      name: 'My South Connector 1',
      description: 'My South connector description',
      enabled: true,
      settings: {} as SouthSettings,
      items: []
    };

    beforeEach(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: stubRoute({
          params: { southId: 'id1' },
          queryParams: { type: 'SQL' }
        })
      });

      southConnectorService.get.and.returnValue(of(southConnector));
      tester = new EditSouthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      expect(southConnectorService.get).toHaveBeenCalledWith('id1');
      expect(tester.title).toContainText('Edit My South Connector 1');
      expect(tester.enabled).toBeChecked();
      expect(tester.description).toHaveValue('My South connector description');
      expect(tester.specificForm).toBeDefined();
      expect(tester.specificTitle).toContainText('Folder scanner settings');
    });
  });

  describe('MQTT connector specific behavior', () => {
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
          wrapInBox: true
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
    beforeEach(() => {
      southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(manifest));

      TestBed.overrideProvider(ActivatedRoute, {
        useValue: stubRoute({ queryParams: { type: 'MQTT' } })
      });
    });

    it('should load MQTT connector manifest', () => {
      tester = new EditSouthComponentTester();
      tester.detectChanges();

      expect(tester.title).toContainText('Create MQTT south connector');
      expect(southConnectorService.getSouthConnectorTypeManifest).toHaveBeenCalledWith('MQTT');
    });

    it('should display MQTT-specific settings form', () => {
      tester = new EditSouthComponentTester();
      tester.detectChanges();

      expect(tester.specificForm).toBeDefined();
      expect(tester.specificTitle).toContainText('MQTT settings');
    });
  });
});
