import { Instant } from '../../../../../shared/model/common/types';

import type OIAnalyticsClient from '../../../../service/oia/oianalytics-client.service';
import { createMock, Mocked } from '../../../utils/test-utils';

/**
 * A mock of the OIAnalytics client, whose requests succeed with empty results
 */
export const createOIAnalyticsClientMock = (): Mocked<OIAnalyticsClient> =>
  createMock<OIAnalyticsClient>({
    pendingServerIdentity: null,
    retrieveCancelledCommands: async () => [],
    retrievePendingCommands: async () => [],
    register: async () => ({ redirectUrl: '', expirationDate: '' as Instant, activationCode: '' }),
    checkRegistration: async () => ({ status: '', expired: false }),
    refreshToken: async () => ({ accessToken: '', accessTokenExpiresIn: 0, refreshToken: '', refreshTokenExpiresIn: 0 }),
    exchangeToken: async () => ({ accessToken: '', accessTokenExpiresIn: 0, refreshToken: '', refreshTokenExpiresIn: 0 }),
    retrieveConfigurationFile: async () => '',
    uploadCommandFile: async () => 'fileId',
    retrieveSessionRequests: async () => [],
    updateCommandStatus: async () => undefined,
    sendConfiguration: async () => undefined,
    sendHistoryQuery: async () => undefined,
    sendSyncMetadata: async () => undefined,
    deleteHistoryQuery: async () => undefined,
    downloadFile: async () => undefined,
    completeSessionRequest: async () => undefined,
    uploadSessionRequestFile: async () => undefined,
    closeSession: async () => undefined,
    retrieveServerIdentity: async () => null,
    testConnection: async () => undefined
  });
