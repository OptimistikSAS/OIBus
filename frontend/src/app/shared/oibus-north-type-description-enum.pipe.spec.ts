import { OIBusNorthTypeDescriptionEnumPipe } from './oibus-north-type-description-enum.pipe';
import { testEnumPipe } from './base-enum-pipe.spec';

describe('OIBusNorthTypeDescriptionEnumPipe', () => {
  it('should translate north type description', () => {
    testEnumPipe(OIBusNorthTypeDescriptionEnumPipe, {
      'aws-s3': 'Store files in Amazon S3™ (Simple Storage Service)',
      'azure-blob': 'Store files in Microsoft Azure Blob Storage™',
      console: 'Display filenames or values in Console (used for debug)',
      'file-writer': 'Write files and data to the output folder',
      oianalytics: 'Send files and values to OIAnalytics®',
      sftp: 'Upload files and data to an SFTP server'
    });
  });
});
