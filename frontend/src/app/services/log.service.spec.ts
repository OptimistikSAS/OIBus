import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { Page } from '../../../../backend/shared/model/types';
import { toPage } from '../shared/test-utils';
import { LogService } from './log.service';
import { LogDTO, Scope } from '../../../../backend/shared/model/logs.model';

describe('LogService', () => {
  let http: HttpTestingController;
  let service: LogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(LogService);
  });

  afterEach(() => http.verify());

  test('should search Logs', () => {
    let expectedLogs: Page<LogDTO> | null = null;
    const logs = toPage<LogDTO>([
      {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'error',
        scopeType: 'internal',
        scopeName: null,
        scopeId: null,
        itemId: null,
        itemName: null,
        groupId: null,
        groupName: null,
        message: 'my log 1'
      },
      {
        timestamp: '2023-01-02T00:00:00.000Z',
        level: 'error',
        scopeType: 'internal',
        scopeName: null,
        scopeId: null,
        itemId: null,
        itemName: null,
        groupId: null,
        groupName: null,
        message: 'my log 2'
      }
    ]);

    service
      .search({
        page: 0,
        messageContent: 'messageContent',
        scopeTypes: ['internal', 'south'],
        scopeIds: ['id1', 'id2'],
        itemIds: ['itemId1', 'itemId2'],
        groupIds: [],
        start: '2023-01-01T00:00:00.000Z',
        end: '2023-01-02T00:00:00.000Z',
        levels: ['info', 'debug']
      })
      .subscribe(c => (expectedLogs = c));

    http
      .expectOne({
        url: '/api/logs?page=0&messageContent=messageContent&start=2023-01-01T00:00:00.000Z&end=2023-01-02T00:00:00.000Z&scopeTypes=internal,south&scopeIds=id1,id2&itemIds=itemId1,itemId2&levels=info,debug',
        method: 'GET'
      })
      .flush(logs);
    expect(expectedLogs!).toEqual(logs);
  });

  test('should suggest scopes by name', () => {
    let expectedScopes: Array<Scope> = [];
    const scopes: Array<Scope> = [
      {
        scopeId: 'id1',
        scopeName: 'name'
      },
      {
        scopeId: 'id2',
        scopeName: 'name'
      }
    ];

    service.suggestScopes('name').subscribe(c => (expectedScopes = c));

    http
      .expectOne({
        url: '/api/logs/scopes/suggest?name=name',
        method: 'GET'
      })
      .flush(scopes);
    expect(expectedScopes!).toEqual(scopes);
  });

  test('should get scope by id', () => {
    let expectedScope: Scope | null = null;
    const scope: Scope = {
      scopeId: 'id1',
      scopeName: 'name'
    };

    service.getScopeById('id1').subscribe(c => (expectedScope = c));

    http
      .expectOne({
        url: '/api/logs/scopes/id1',
        method: 'GET'
      })
      .flush(scope);
    expect(expectedScope!).toEqual(scope);
  });
});
