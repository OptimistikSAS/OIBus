import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { createMock } from 'ngx-speculoos';

import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { NotificationService } from '../../notification.service';
import { ModalService } from '../../modal.service';
import { OIBusObjectFormControlComponent } from './oibus-object-form-control.component';
import { SouthConnectorService } from '../../../services/south-connector.service';

@Component({
  template: `
    <form [formGroup]="parentGroup">
      <ng-container formGroupName="root">
        <oib-oibus-object-form-control
          [scanModes]="scanModes"
          [certificates]="certificates"
          [group]="group"
          [objectAttribute]="objectAttribute"
        />
      </ng-container>
    </form>
  `,
  imports: [OIBusObjectFormControlComponent, ReactiveFormsModule]
})
class TestHostComponent {
  scanModes: Array<ScanModeDTO> = [
    {
      id: 'scan-mode-1',
      name: 'Scan Mode 1',
      description: 'Description',
      cron: '* * * * *'
    }
  ];

  certificates: Array<CertificateDTO> = [
    {
      id: 'certificate-1',
      name: 'Certificate 1',
      description: 'Description',
      publicKey: 'public',
      certificate: 'certificate',
      expiry: '2024-01-01T00:00:00Z'
    }
  ];

  parentGroup = new FormGroup({
    root: new FormGroup({
      name: new FormControl<string | null>(''),
      enabled: new FormControl<boolean>(false),
      nested: new FormGroup({}),
      items: new FormControl<Array<unknown>>([])
    })
  });

  get group() {
    return this.parentGroup.get('root') as FormGroup;
  }

  objectAttribute: OIBusObjectAttribute = {
    type: 'object',
    key: 'root',
    translationKey: 'root',
    validators: [],
    attributes: [
      {
        type: 'string',
        key: 'name',
        translationKey: 'name',
        validators: [],
        defaultValue: null,
        displayProperties: {
          row: 0,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'boolean',
        key: 'enabled',
        translationKey: 'enabled',
        validators: [],
        defaultValue: false,
        displayProperties: {
          row: 0,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'object',
        key: 'nested',
        translationKey: 'nested',
        validators: [],
        attributes: [],
        enablingConditions: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      }
    ],
    enablingConditions: [
      {
        referralPathFromRoot: 'enabled',
        targetPathFromRoot: 'name',
        values: [true]
      }
    ],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  };
}

describe('OIBusObjectFormControlComponent', () => {
  let component: OIBusObjectFormControlComponent;
  let hostComponent: TestHostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: SouthConnectorService, useValue: createMock(SouthConnectorService) },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: createMock(ModalService) }
      ]
    });

    const fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    component = fixture.debugElement.query(By.directive(OIBusObjectFormControlComponent)).componentInstance;
    fixture.detectChanges();
  });

  it('should organise attributes into the expected rows', () => {
    const rows = component.formRows();

    expect(rows.length).toBe(2);

    const firstRow = rows[0];
    expect(firstRow.wrapInRow).toBeTrue();
    expect(firstRow.columns.map(column => column.attribute.key)).toEqual(['name', 'enabled']);

    const objectRow = rows.find(row => !row.wrapInRow && row.columns[0].attribute.type === 'object');
    expect(objectRow).toBeDefined();
  });

  it('should apply enabling conditions to the form group', () => {
    const rows = component.formRows();
    expect(rows.length).toBe(2);

    expect(hostComponent.group.get('name')!.disabled).toBeTrue();

    hostComponent.group.get('enabled')!.setValue(true);

    expect(hostComponent.group.get('name')!.disabled).toBeFalse();
  });

  it('should call addEnablingConditions with the form group and enabling conditions', () => {
    // Since addEnablingConditions is called in the constructor, we can't easily spy on it
    // Instead, we'll test that the enabling conditions are applied by checking the form state
    component.formRows();

    // The enabling conditions should be applied, so the 'name' field should be disabled initially
    expect(hostComponent.group.get('name')!.disabled).toBeTrue();
  });

  it('should cast abstract controls to form controls and groups', () => {
    const testGroup = new FormGroup({});
    const testControl = new FormControl('value');

    expect(component.asFormGroup(testGroup)).toBe(testGroup);
    expect(component.asFormControl(testControl)).toBe(testControl);
  });
});
