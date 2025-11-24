import { TestBed } from '@angular/core/testing';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { OiaCommandDetailsModalComponent } from './oia-command-details-modal.component';
import { OIBusUpdateSouthConnectorCommandDTO, OIBusUpdateVersionCommandDTO } from '../../../../../../backend/shared/model/command.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { SouthConnectorCommandDTO } from '../../../../../../backend/shared/model/south-connector.model';

class OIBusCommandDetailsModalComponentTester extends ComponentTester<OiaCommandDetailsModalComponent> {
  constructor() {
    super(OiaCommandDetailsModalComponent);
  }

  get commandResults() {
    return this.element('.command-result')!;
  }

  get commandContents() {
    return this.element('.command-content')!;
  }

  get close() {
    return this.button('#close-button')!;
  }
}

describe('OIBusCommandDetailsModalComponent', () => {
  let tester: OIBusCommandDetailsModalComponentTester;

  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  const command1: OIBusUpdateVersionCommandDTO = {
    id: 'id1',
    type: 'update-version',
    retrievedDate: null,
    completedDate: null,
    status: 'RETRIEVED',
    commandContent: {
      version: 'v3.2',
      assetId: 'assetId',
      updateLauncher: true,
      backupFolders: 'cache/*'
    },
    ack: false,
    result: null
  };
  const command2: OIBusUpdateSouthConnectorCommandDTO = {
    id: 'id2',
    type: 'update-south',
    retrievedDate: '2021-01-01T01:00:00.000Z',
    completedDate: '2021-01-01T02:00:00.000Z',
    status: 'COMPLETED',
    result: 'completed successfully',
    targetVersion: '3.2.0',
    southConnectorId: 'southId1',
    commandContent: {
      name: 'south'
    } as SouthConnectorCommandDTO,
    ack: false
  };
  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser(), { provide: NgbActiveModal, useValue: activeModal }]
    });

    tester = new OIBusCommandDetailsModalComponentTester();
  });

  it('should close', async () => {
    tester.componentInstance.prepare(command1);
    await tester.change();

    tester.close.click();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  it('should display an update version command', async () => {
    tester.componentInstance.prepare(command1);
    await tester.change();

    expect(tester.commandResults).toContainText(' ');
    expect(tester.commandContents.elements('li').length).toEqual(4);
    expect(tester.commandContents.elements('li')[0]).toContainText(command1.commandContent.version);
    expect(tester.commandContents.elements('li')[1]).toContainText(command1.commandContent.assetId);
    expect(tester.commandContents.elements('li')[2]).toContainText('Yes');
    expect(tester.commandContents.elements('li')[3]).toContainText(command1.commandContent.backupFolders);
  });

  it('should display an update south command', async () => {
    tester.componentInstance.prepare(command2);
    await tester.change();

    expect(tester.commandResults).toContainText(command2.result!);
    expect(tester.commandContents.elements('li').length).toEqual(3);
    expect(tester.commandContents.elements('li')[0]).toContainText(' 1 Jan 2021, 02:00:00');
    expect(tester.commandContents.elements('li')[1]).toContainText(command2.southConnectorId);
    expect(tester.commandContents.elements('li')[2]).toContainText('"name": "south"');
  });
});
