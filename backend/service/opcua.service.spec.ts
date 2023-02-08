import fs from 'node:fs/promises';
import path from 'node:path';
import { createFolder } from './utils';

import { initOpcuaCertificateFolders } from './opcua.service';

jest.mock('./utils');

describe('opcua service', () => {
  it('should copy certificates', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => {
      throw new Error('does not exist');
    });
    jest.spyOn(path, 'join').mockImplementationOnce(() => 'stubFolder');
    fs.copyFile = jest.fn();

    await initOpcuaCertificateFolders('certFolder');
    expect(createFolder).toHaveBeenCalledTimes(10);
  });
});
