import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { LogDTO } from '@oibus/shared/api/logs.model';
import { Group, Item, Scope } from '@oibus/shared/domain/logs.model';

import { expectHttp } from '../../test/http-testing';
import { toPage } from '../shared/utils/page.utils';
import { LogService } from './log.service';

interface HttpCase {
  name: string;
  call: (service: LogService) => Observable<unknown>;
  url: string;
  response: unknown;
}

const logs: Array<LogDTO> = [
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
    scopeType: 'south',
    scopeName: 'South 1',
    scopeId: 'id1',
    itemId: 'itemId1',
    itemName: 'Item 1',
    groupId: 'groupId1',
    groupName: 'Group 1',
    message: 'my log 2'
  }
];
const scope: Scope = { scopeId: 'id1', scopeName: 'name' };
const item: Item = { itemId: 'itemId1', itemName: 'name', scopeId: 'scopeId', scopeName: 'scopeName' };
const group: Group = { groupId: 'groupId1', groupName: 'name', scopeId: 'scopeId', scopeName: 'scopeName' };

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

  test.each<HttpCase>([
    {
      name: 'search logs with every filter',
      call: s =>
        s.search({
          page: 0,
          messageContent: 'messageContent',
          scopeTypes: ['internal', 'south'],
          scopeIds: ['id1', 'id2'],
          itemIds: ['itemId1', 'itemId2'],
          groupIds: ['groupId1', 'groupId2'],
          start: '2023-01-01T00:00:00.000Z',
          end: '2023-01-02T00:00:00.000Z',
          levels: ['info', 'debug']
        }),
      url:
        '/api/logs?page=0&messageContent=messageContent&start=2023-01-01T00:00:00.000Z&end=2023-01-02T00:00:00.000Z' +
        '&scopeTypes=internal,south&scopeIds=id1,id2&itemIds=itemId1,itemId2&groupIds=groupId1,groupId2&levels=info,debug',
      response: toPage(logs)
    },
    {
      name: 'search logs with empty filters, leaving out the empty group filter',
      call: s =>
        s.search({
          page: 3,
          messageContent: undefined,
          start: undefined,
          end: undefined,
          scopeTypes: [],
          scopeIds: [],
          itemIds: [],
          groupIds: [],
          levels: []
        }),
      url: '/api/logs?page=3&scopeTypes=&scopeIds=&itemIds=&levels=',
      response: toPage(logs)
    },
    { name: 'suggest scopes by name', call: s => s.suggestScopes('name'), url: '/api/logs/scopes/suggest?name=name', response: [scope] },
    { name: 'get a scope by id', call: s => s.getScopeById('id1'), url: '/api/logs/scopes/id1', response: scope },
    { name: 'get an unknown scope', call: s => s.getScopeById('unknown'), url: '/api/logs/scopes/unknown', response: null },
    { name: 'suggest items by name', call: s => s.suggestItems('name'), url: '/api/logs/items/suggest?name=name', response: [item] },
    {
      name: 'suggest items by name restricted to a scope',
      call: s => s.suggestItems('name', 'scopeId'),
      url: '/api/logs/items/suggest?name=name&scopeId=scopeId',
      response: [item]
    },
    { name: 'get an item by id', call: s => s.getItemById('itemId1'), url: '/api/logs/items/itemId1', response: item },
    { name: 'suggest groups by name', call: s => s.suggestGroups('name'), url: '/api/logs/groups/suggest?name=name', response: [group] },
    {
      name: 'suggest groups by name restricted to a scope',
      call: s => s.suggestGroups('name', 'scopeId'),
      url: '/api/logs/groups/suggest?name=name&scopeId=scopeId',
      response: [group]
    },
    { name: 'get a group by id', call: s => s.getGroupById('groupId1'), url: '/api/logs/groups/groupId1', response: group }
  ])('should $name', async ({ call, url, response }) => {
    const result = await expectHttp(http, call(service), { method: 'GET', url }, { response });

    expect(result).toEqual(response);
  });
});
