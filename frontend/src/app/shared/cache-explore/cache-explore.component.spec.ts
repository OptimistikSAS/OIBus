import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CacheExploreComponent } from './cache-explore.component';
import { BehaviorSubject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { ObservableState } from '../save-button/save-button.component';
import { CacheContentUpdateCommand, CacheOperation, CacheSearchResult } from '../../../../../backend/shared/model/engine.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideCurrentUser } from '../current-user-testing-vitest';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  template: `<oib-cache-explore
    [entity]="{ id: 'north-1', type: 'north' }"
    [cacheContent]="cacheSearchResult"
    [state]="state()"
    (updateCommand)="lastUpdateCommand.set($event)"
  /> `,
  imports: [CacheExploreComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  cacheSearchResult: CacheSearchResult = {
    searchDate: '2025-01-01T00:00:00.000Z',
    metrics: {
      lastConnection: '2023-01-01T00:00:00.000Z',
      lastRunStart: null,
      lastRunDuration: null,
      currentCacheSize: 100,
      currentErrorSize: 50,
      currentArchiveSize: 200
    },
    cache: [
      {
        filename: 'file-cache-1.json',
        metadata: {
          contentFile: 'data-1.txt',
          contentSize: 100,
          numberOfElement: 1,
          createdAt: '2023-01-01T10:00:00.000Z',
          contentType: 'any'
        }
      }
    ],
    error: [
      {
        filename: 'file-error-1.json',
        metadata: {
          contentFile: 'error-1.txt',
          contentSize: 50,
          numberOfElement: 1,
          createdAt: '2023-01-01T11:00:00.000Z',
          contentType: 'any'
        }
      }
    ],
    archive: []
  };
  state = signal<ObservableState>({ isPending: new BehaviorSubject(false), pendingUntilFinalization: () => source => source });
  lastUpdateCommand = signal<
    | {
        type: 'north' | 'history';
        id: string;
        updateCommand: CacheContentUpdateCommand;
      }
    | undefined
  >(undefined);
}

class CacheExploreComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly snapshotWarning = this.root.getByCss('.alert-info');
  readonly dirtyWarning = this.root.getByCss('.alert-warning');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cacheContent = this.root.getByCss('oib-cache-content');
  readonly spinner = this.root.getByCss('.fa-spinner');

  get cacheExplore(): CacheExploreComponent {
    return this.fixture.debugElement.query(By.directive(CacheExploreComponent)).componentInstance;
  }

  handleOperation(operation: CacheOperation) {
    this.cacheExplore.handleOperation(operation);
    this.fixture.detectChanges();
  }
}

describe('CacheExploreComponent', () => {
  let tester: CacheExploreComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser()]
    });

    tester = new CacheExploreComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display snapshot warning initially', async () => {
    await expect.element(tester.snapshotWarning).toHaveTextContent('The state of the cache may have changed in OIBus since the search.');
  });

  test('should NOT display dirty warning or save button initially', async () => {
    await expect.element(tester.dirtyWarning).not.toBeInTheDocument();
    await expect.element(tester.saveButton).not.toBeInTheDocument();
  });

  test('should display 3 north-cache-content components (cache, error, archive)', async () => {
    await expect.element(tester.cacheContent).toHaveLength(3);
  });

  test('should handle REMOVE operation and enable save', async () => {
    const operation: CacheOperation = {
      action: 'remove',
      folder: 'cache',
      filenames: ['file-cache-1.json']
    };

    tester.handleOperation(operation);

    await expect.element(tester.dirtyWarning).toBeInTheDocument();
    await expect.element(tester.saveButton).toBeInTheDocument();
    await expect.element(tester.saveButton).not.toBeDisabled();
  });

  test('should handle MOVE operation and enable save', async () => {
    const operation: CacheOperation = {
      action: 'move',
      source: 'error',
      destination: 'cache',
      filenames: ['file-error-1.json']
    };

    tester.handleOperation(operation);

    await expect.element(tester.dirtyWarning).toBeInTheDocument();
    await expect.element(tester.saveButton).toBeInTheDocument();
  });

  test('should emit update command on save', async () => {
    tester.handleOperation({
      action: 'move',
      source: 'error',
      destination: 'cache',
      filenames: ['file-error-1.json']
    });

    await tester.saveButton.click();

    const emittedCommand = tester.component.lastUpdateCommand();
    expect(emittedCommand).toBeDefined();

    expect(emittedCommand!.type).toBe('north');
    expect(emittedCommand!.id).toBe('north-1');

    const json = emittedCommand!.updateCommand;

    expect(json.error.move.length).toBe(1);
    expect(json.error.move[0]).toEqual({ filename: 'file-error-1.json', to: 'cache' });
    expect(json.error.remove.length).toBe(0);

    expect(json.cache.move.length).toBe(0);
    expect(json.cache.remove.length).toBe(0);
  });

  test('should disable save button when pending', async () => {
    tester.handleOperation({
      action: 'remove',
      folder: 'cache',
      filenames: ['file-cache-1.json']
    });

    tester.component.state().isPending.next(true);
    tester.fixture.detectChanges();

    await expect.element(tester.saveButton).toBeDisabled();
    await expect.element(tester.spinner).toBeInTheDocument();
  });
});
