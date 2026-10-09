import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { firstValueFrom, isObservable, of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { TransformerService } from '../../services/transformer.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { EditNorthComponent } from './edit-north.component';

const manifest: NorthConnectorManifest = {
  ...testData.north.manifest,
  id: 'file-writer',
  settings: {
    ...testData.north.manifest.settings,
    attributes: [
      {
        type: 'string',
        key: 'outputFolder',
        translationKey: 'configuration.oibus.manifest.north.file-writer.output-folder',
        defaultValue: null,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      }
    ]
  }
};

class EditNorthComponentTester {
  readonly fixture = TestBed.createComponent(EditNorthComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly name = this.root.getByLabelText('Name', { exact: true });
  readonly description = this.root.getByLabelText('Description', { exact: true });
  readonly outputFolder = this.root.getByLabelText('Output folder');
  readonly scanMode = this.root.getByLabelText('Schedule');
  readonly numberOfElements = this.root.getByLabelText('Number of elements');
  readonly transformerRows = this.root.getByCss('oib-north-transformers tbody tr');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly testButton = this.root.getByRole('button', { name: 'Test settings' });
}

describe('EditNorthComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;
  let northConnector: NorthConnectorDTO;

  function configure(route: { params?: Record<string, string>; queryParams?: Record<string, string> }) {
    const engineService = createMock(EngineService);
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([{ path: 'north/:northId', component: EmptyRouteComponent }]),
        provideModalTesting(),
        { provide: ActivatedRoute, useValue: stubRoute(route) },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: EngineService, useValue: engineService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });
    TestBed.createComponent(DefaultValidationErrorsComponent);
  }

  let scanModeService: MockObject<ScanModeService>;
  let certificateService: MockObject<CertificateService>;
  let transformerService: MockObject<TransformerService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let confirmationService: MockObject<ConfirmationService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);
    transformerService = createMock(TransformerService);
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    northConnector = structuredClone(testData.north.list[0]);
    northConnectorService.getNorthManifest.mockReturnValue(of(manifest));
    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    northConnectorService.findById.mockReturnValue(of(northConnector));
    northConnectorService.create.mockReturnValue(of(northConnector));
    northConnectorService.update.mockReturnValue(of(undefined));
    scanModeService.list.mockReturnValue(of(testData.scanMode.list));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([]));
    confirmationService.confirm.mockReturnValue(of(undefined));
    unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));
  });

  describe('create mode', () => {
    beforeEach(() => configure({ queryParams: { type: 'file-writer' } }));

    test('should display an empty form with default values', async () => {
      const tester = new EditNorthComponentTester();

      await expect.element(tester.title).toHaveTextContent('Create File writer north connector');
      expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('file-writer');
      expect(northConnectorService.findById).not.toHaveBeenCalled();
      await expect.element(tester.name).toHaveValue('');
      await expect.element(tester.numberOfElements).toHaveValue(1000);
      await expect.element(tester.transformerRows).toHaveLength(0);
    });

    test('should not save an invalid form', async () => {
      const tester = new EditNorthComponentTester();

      await tester.saveButton.click();

      await expect.element(tester.root.getByText('This field is required').first()).toBeInTheDocument();
      expect(northConnectorService.create).not.toHaveBeenCalled();
    });

    test('should check that the name is unique', async () => {
      const tester = new EditNorthComponentTester();

      await tester.name.fill(' north 2 ');
      await tester.saveButton.click();

      await expect.element(tester.root.getByText('Must be unique')).toBeInTheDocument();
      expect(northConnectorService.create).not.toHaveBeenCalled();
    });

    test('should create a north connector', async () => {
      const tester = new EditNorthComponentTester();

      await tester.name.fill('New north');
      await tester.description.fill('my description');
      await tester.outputFolder.fill('/out');
      await tester.scanMode.selectOptions('scanMode1');
      await tester.saveButton.click();

      expect(northConnectorService.create).toHaveBeenCalledWith(
        {
          name: 'New north',
          type: 'file-writer',
          description: 'my description',
          enabled: true,
          settings: { outputFolder: '/out' },
          caching: {
            trigger: { scanModeId: 'scanModeId1', scanModeName: null, numberOfElements: 1000, numberOfFiles: 1 },
            throttling: { runMinDelay: 200, maxSize: 0, maxNumberOfElements: 10000 },
            error: { retryInterval: 5000, retryCount: 3, retentionDuration: 0 },
            archive: { enabled: false, retentionDuration: 72 }
          },
          transformers: []
        },
        ''
      );
      expect(notificationService.success).toHaveBeenCalledWith('north.created', { name: 'New north' });
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/north/northId1'));
    });

    test('should test the connection with the settings only', async () => {
      const modalService = TestBed.inject(MockModalService);
      const fakeModal = createMock(TestConnectionResultModalComponent);
      modalService.mockClosedModal(fakeModal);
      const tester = new EditNorthComponentTester();

      await tester.testButton.click();
      await expect.element(tester.root.getByText('This field is required').first()).toBeInTheDocument();
      expect(fakeModal.runTest).not.toHaveBeenCalled();

      await tester.outputFolder.fill('/out');
      await tester.testButton.click();

      expect(fakeModal.runTest).toHaveBeenCalledWith('north', null, { outputFolder: '/out' }, 'file-writer');
    });

    test('should ask for confirmation before leaving a modified form', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.name).toBeInTheDocument();
      expect(tester.fixture.componentInstance.canDeactivate()).toBe(true);

      await tester.name.fill('New north');

      const result = tester.fixture.componentInstance.canDeactivate();
      expect(isObservable(result) && (await firstValueFrom(result))).toBe(true);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    beforeEach(() => configure({ params: { northId: 'northId1' } }));

    test('should display the north connector without mutating it', async () => {
      const tester = new EditNorthComponentTester();

      await expect.element(tester.title).toHaveTextContent('Edit North 1');
      expect(northConnectorService.findById).toHaveBeenCalledWith('northId1');
      await expect.element(tester.name).toHaveValue('North 1');
      await expect.element(tester.outputFolder).toHaveValue('output-folder');
      await expect.element(tester.scanMode).toHaveDisplayValue('scanMode1');
      await expect.element(tester.numberOfElements).toHaveValue(250);
      await expect.element(tester.transformerRows).toHaveLength(3);
      expect(northConnector).toEqual(testData.north.list[0]);
    });

    test('should accept its own name', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.name).toHaveValue('North 1');

      await tester.name.fill('north 1');
      await tester.saveButton.click();

      expect(northConnectorService.update).toHaveBeenCalled();
    });

    test('should update the north connector with the in-memory transformers', async () => {
      const tester = new EditNorthComponentTester();
      await expect.element(tester.transformerRows).toHaveLength(3);

      await tester.transformerRows.nth(0).getByRole('button', { name: 'Delete transformer' }).click();
      await tester.description.fill('updated');
      await tester.saveButton.click();

      expect(northConnectorService.removeTransformer).not.toHaveBeenCalled();
      const [northId, command] = northConnectorService.update.mock.lastCall!;
      expect(northId).toBe('northId1');
      expect(command).toEqual(
        expect.objectContaining({
          name: 'North 1',
          description: 'updated',
          caching: expect.objectContaining({
            trigger: { scanModeId: 'scanModeId1', scanModeName: null, numberOfElements: 250, numberOfFiles: 1 }
          })
        })
      );
      expect(command.transformers.map(transformer => transformer.id)).toEqual(['northTransformerId2', 'northTransformerId3']);
      expect(command.transformers[0]).toEqual({
        id: 'northTransformerId2',
        transformerId: 'transformerId2',
        options: {},
        source: { type: 'oibus-api', dataSourceId: 'dataSourceId1' }
      });
      expect(notificationService.success).toHaveBeenCalledWith('north.updated', { name: 'North 1' });
      expect(northConnectorService.findById).toHaveBeenCalledTimes(2);
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/north/northId1'));
    });

    test('should test the connection of the edited connector', async () => {
      const modalService = TestBed.inject(MockModalService);
      const fakeModal = createMock(TestConnectionResultModalComponent);
      modalService.mockClosedModal(fakeModal);
      const tester = new EditNorthComponentTester();
      await expect.element(tester.outputFolder).toHaveValue('output-folder');

      await tester.testButton.click();

      expect(fakeModal.runTest).toHaveBeenCalledWith('north', 'northId1', { outputFolder: 'output-folder' }, 'file-writer');
    });
  });

  describe('duplicate mode', () => {
    beforeEach(() => configure({ queryParams: { duplicate: 'northId1' } }));

    test('should create a copy of the duplicated connector', async () => {
      const tester = new EditNorthComponentTester();

      await expect.element(tester.title).toHaveTextContent('Create File writer north connector');
      expect(northConnectorService.findById).toHaveBeenCalledWith('northId1');
      await expect.element(tester.name).toHaveValue('North 1');
      // the duplicated connector's name is already used
      await tester.name.fill('North 1 copy');
      await tester.saveButton.click();

      expect(northConnectorService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'North 1 copy', type: 'file-writer' }),
        'northId1'
      );
      expect(northConnectorService.create.mock.lastCall![0].transformers).toHaveLength(3);
    });
  });
});
