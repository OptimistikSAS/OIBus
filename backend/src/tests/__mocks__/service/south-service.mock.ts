import { SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';

export const southTestManifest: SouthConnectorManifest = {
  id: 'south-test',
  category: 'debug',
  name: 'Test',
  description: '',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: true,
    history: true,
    forceMaxInstantPerItem: true
  },
  settings: [],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'objectArray',
        type: 'OibArray',
        label: 'Array',
        content: []
      },
      {
        key: 'objectSettings',
        type: 'OibFormGroup',
        label: 'Group',
        content: []
      },
      {
        key: 'objectValue',
        type: 'OibNumber',
        label: 'Number'
      }
    ]
  }
};

/**
 * Create a mock object for South Service
 */
export default jest.fn().mockImplementation(() => ({
  createSouth: jest.fn(),
  getSouth: jest.fn(),
  getSouthList: jest.fn(),
  getSouthItems: jest.fn(),
  getInstalledSouthManifests: jest.fn(() => [southTestManifest])
}));
