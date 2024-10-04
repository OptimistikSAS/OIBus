import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';

export const northTestManifest: NorthConnectorManifest = {
  id: 'north-test',
  category: 'debug',
  name: 'Test',
  description: '',
  modes: {
    files: true,
    points: true
  },
  settings: []
};
/**
 * Create a mock object for North Service
 */
export default jest.fn().mockImplementation(() => ({
  createNorth: jest.fn(),
  getNorth: jest.fn(),
  getNorthList: jest.fn(),
  getInstalledNorthManifests: jest.fn(() => [northTestManifest])
}));
