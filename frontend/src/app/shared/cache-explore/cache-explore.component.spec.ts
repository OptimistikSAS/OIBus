import { TestBed } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';
import { Component, signal } from '@angular/core';
import { CacheExploreComponent } from './cache-explore.component';
import { BehaviorSubject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { ObservableState } from '../save-button/save-button.component';
import { CacheContentUpdateCommand, CacheOperation, CacheSearchResult } from '../../../../../backend/shared/model/engine.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideCurrentUser } from '../current-user-testing';

@Component({
  template: `<oib-cache-explore
    [entity]="{ id: 'north-1', type: 'north' }"
    [cacheContent]="cacheSearchResult"
    [state]="state()"
    (updateCommand)="lastUpdateCommand.set($event)"
  /> `,
  imports: [CacheExploreComponent]
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

class CacheExploreComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get snapshotWarning() {
    return this.element('.alert-info');
  }

  get dirtyWarning() {
    return this.element('.alert-warning');
  }

  get saveButton() {
    return this.button('button.btn-primary');
  }

  get cacheContent() {
    return this.elements('oib-cache-content');
  }

  // Helper to access the child component instance directly
  get cacheSearchComponent(): CacheExploreComponent {
    return this.debugElement.query(By.directive(CacheExploreComponent)).componentInstance;
  }
}

describe('CacheExploreComponent', () => {
  let tester: CacheExploreComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser()]
    });

    tester = new CacheExploreComponentTester();
    await tester.change();
  });

  it('should display snapshot warning initially', () => {
    expect(tester.snapshotWarning).not.toBeNull();
    // Use the translation key part to verify content
    expect(tester.snapshotWarning!.textContent).toContain(' The state of the cache may have changed in OIBus since the search.');
  });

  it('should NOT display dirty warning or save button initially', () => {
    expect(tester.dirtyWarning).toBeNull();
    expect(tester.saveButton).toBeNull();
  });

  it('should display 3 north-cache-content components (cache, error, archive)', () => {
    expect(tester.cacheContent.length).toBe(3);
  });

  it('should handle REMOVE operation and enable save', async () => {
    // Simulate removing a file from Cache
    const operation: CacheOperation = {
      action: 'remove',
      folder: 'cache',
      filenames: ['file-cache-1.json']
    };

    // Trigger handleOperation
    tester.cacheSearchComponent.handleOperation(operation);
    await tester.change();

    expect(tester.dirtyWarning).not.toBeNull();
    expect(tester.saveButton).not.toBeNull();
    expect(tester.saveButton!.disabled).toBeFalse();
  });

  it('should handle MOVE operation and enable save', async () => {
    // Simulate moving a file from Error to Cache (Retry)
    const operation: CacheOperation = {
      action: 'move',
      source: 'error',
      destination: 'cache',
      filenames: ['file-error-1.json']
    };

    tester.cacheSearchComponent.handleOperation(operation);
    await tester.change();

    expect(tester.dirtyWarning).not.toBeNull();
    expect(tester.saveButton).not.toBeNull();
  });

  it('should emit update command on save', async () => {
    // 1. Perform an action (Move Error -> Cache)
    tester.cacheSearchComponent.handleOperation({
      action: 'move',
      source: 'error',
      destination: 'cache',
      filenames: ['file-error-1.json']
    });
    await tester.change();

    // 2. Click Save
    await tester.saveButton!.click();

    // 3. Verify Output
    const emittedCommand = tester.componentInstance.lastUpdateCommand();
    expect(emittedCommand).toBeDefined();

    // Check basic command structure
    expect(emittedCommand!.type).toBe('north');
    expect(emittedCommand!.id).toBe('north-1');

    const json = emittedCommand!.updateCommand;

    // Check Error folder operations (origin: error -> new: cache)
    expect(json.error.move.length).toBe(1);
    expect(json.error.move[0]).toEqual({ filename: 'file-error-1.json', to: 'cache' });
    expect(json.error.remove.length).toBe(0);

    // Check Cache folder operations (origin: cache -> new: cache)
    // Since 'file-cache-1.json' was not touched, it remains in cache.
    // The command calculates diffs from ORIGIN lists.
    // For origin 'cache', the file is still in 'cache', so no move/remove.
    expect(json.cache.move.length).toBe(0);
    expect(json.cache.remove.length).toBe(0);
  });

  it('should disable save button when pending', async () => {
    // Make dirty to show button
    tester.cacheSearchComponent.handleOperation({
      action: 'remove',
      folder: 'cache',
      filenames: ['file-cache-1.json']
    });
    await tester.change();

    // Set pending state via input
    tester.componentInstance.state().isPending.next(true);
    await tester.change();

    expect(tester.saveButton!.disabled).toBeTrue();
    expect(tester.element('.fa-spinner')).not.toBeNull();
  });
});
