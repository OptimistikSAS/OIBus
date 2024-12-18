import { OIBusNorthTypeEnumPipe } from './oibus-north-type-enum.pipe';
import { testEnumPipe } from './base-enum-pipe.spec';

describe('OIBusNorthTypeEnumPipe', () => {
  it('should translate north type', () => {
    testEnumPipe(OIBusNorthTypeEnumPipe, {
      'aws-s3': 'Amazon S3™',
      'azure-blob': 'Azure Blob Storage™',
      console: 'Console',
      'file-writer': 'File writer',
      oianalytics: 'OIAnalytics®',
      sftp: 'SFTP'
    });
  });
});
