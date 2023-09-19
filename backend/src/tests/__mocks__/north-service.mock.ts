import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

export const northTestManifest: NorthConnectorManifest = {
  id: 'north-test',
  category: 'debug',
  name: 'Test',
  description: '',
  modes: {
    files: true,
    points: true,
    items: false
  },
  settings: []
};

export const northTestManifestWithItems: NorthConnectorManifest<true> = {
  id: 'north-test-with-items',
  category: 'debug',
  name: 'Test',
  description: '',
  modes: {
    files: true,
    points: true,
    items: true
  },
  items: { settings: [] },
  settings: []
};
/**
 * Create a mock object for North Service
 */
export default jest.fn().mockImplementation(() => ({
  createNorth: jest.fn(),
  getNorth: jest.fn(),
  getNorthList: jest.fn(),
  getInstalledNorthManifests: jest.fn(() => [northTestManifest, northTestManifestWithItems])
}));
