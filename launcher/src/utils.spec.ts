import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createFolder,
  delay,
  filesExists,
  parseBooleanOption,
  removeLauncherOnlyArguments,
  replaceConfigArgumentWithAbsolutePath
} from './utils';

const createdDirectories: Array<string> = [];

afterEach(() => {
  while (createdDirectories.length > 0) {
    const directory = createdDirectories.pop();
    if (directory) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('replaceConfigArgumentWithAbsolutePath', () => {
  it('replaces config path with absolute path when --config is present', () => {
    const args = ['node', 'script.js', '--config', './data-folder'];
    const absolutePath = '/absolute/path/to/data-folder';
    const result = replaceConfigArgumentWithAbsolutePath(args, absolutePath);

    expect(result).toContain('--config');
    expect(result).toContain(absolutePath);
    const configIndex = result.indexOf('--config');
    expect(result[configIndex + 1]).toBe(absolutePath);
  });

  it('adds --launcherVersion when --config is present', () => {
    const args = ['node', 'script.js', '--config', './data-folder'];
    const absolutePath = '/absolute/path/to/data-folder';
    const result = replaceConfigArgumentWithAbsolutePath(args, absolutePath);

    expect(result).toContain('--launcherVersion');
  });

  it('does not modify args when --config is not present', () => {
    const args = ['node', 'script.js', '--other', 'value'];
    const absolutePath = '/absolute/path/to/data-folder';
    const result = replaceConfigArgumentWithAbsolutePath(args, absolutePath);

    expect(result).toContain('--launcherVersion');
    expect(result).not.toContain('--config');
  });

  it('handles multiple --config occurrences by replacing the first one', () => {
    const args = ['node', 'script.js', '--config', './data1', '--config', './data2'];
    const absolutePath = '/absolute/path';
    const result = replaceConfigArgumentWithAbsolutePath(args, absolutePath);

    const firstConfigIndex = result.indexOf('--config');
    expect(result[firstConfigIndex + 1]).toBe(absolutePath);
  });
});

describe('removeLauncherOnlyArguments', () => {
  it('removes --reset-password flag', () => {
    const args = ['node', 'script.js', '--config', './data', '--reset-password', 'true'];
    const result = removeLauncherOnlyArguments(args);

    expect(result).not.toContain('--reset-password');
    expect(result).toContain('--config');
  });

  it('removes --reset-password=value format', () => {
    const args = ['node', 'script.js', '--config', './data', '--reset-password=true'];
    const result = removeLauncherOnlyArguments(args);

    expect(result).not.toContain('--reset-password=true');
    expect(result).toContain('--config');
  });

  it('removes --reset-password and its value when separate', () => {
    const args = ['node', 'script.js', '--reset-password', 'true', '--config', './data'];
    const result = removeLauncherOnlyArguments(args);

    expect(result).not.toContain('--reset-password');
    expect(result).not.toContain('true');
    expect(result).toContain('--config');
  });

  it('does not remove value if it looks like another flag', () => {
    const args = ['node', 'script.js', '--reset-password', '--other-flag'];
    const result = removeLauncherOnlyArguments(args);

    expect(result).not.toContain('--reset-password');
    expect(result).toContain('--other-flag');
  });

  it('preserves other arguments', () => {
    const args = ['node', 'script.js', '--config', './data', '--check', '--other', 'value'];
    const result = removeLauncherOnlyArguments(args);

    expect(result).toContain('--config');
    expect(result).toContain('--check');
    expect(result).toContain('--other');
    expect(result).toContain('value');
  });

  it('handles empty array', () => {
    const args: Array<string> = [];
    const result = removeLauncherOnlyArguments(args);

    expect(result).toEqual([]);
  });
});

describe('delay', () => {
  it('resolves after the specified timeout', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(100);
  });
});

describe('createFolder', () => {
  it('creates a folder if it does not exist', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const folderPath = path.join(tempDir, 'new-folder');

    await createFolder(folderPath);

    expect(fs.existsSync(folderPath)).toBe(true);
    expect(fs.statSync(folderPath).isDirectory()).toBe(true);
  });

  it('does not throw if folder already exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const folderPath = path.join(tempDir, 'existing-folder');
    fs.mkdirSync(folderPath, { recursive: true });

    await expect(createFolder(folderPath)).resolves.not.toThrow();
    expect(fs.existsSync(folderPath)).toBe(true);
  });

  it('creates nested folders recursively', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const folderPath = path.join(tempDir, 'level1', 'level2', 'level3');

    await createFolder(folderPath);

    expect(fs.existsSync(folderPath)).toBe(true);
    expect(fs.statSync(folderPath).isDirectory()).toBe(true);
  });
});

describe('filesExists', () => {
  it('returns true if file exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const filePath = path.join(tempDir, 'test-file.txt');
    fs.writeFileSync(filePath, 'test content');

    const exists = await filesExists(filePath);

    expect(exists).toBe(true);
  });

  it('returns false if file does not exist', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const filePath = path.join(tempDir, 'non-existent-file.txt');

    const exists = await filesExists(filePath);

    expect(exists).toBe(false);
  });

  it('returns true if directory exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const dirPath = path.join(tempDir, 'test-dir');
    fs.mkdirSync(dirPath);

    const exists = await filesExists(dirPath);

    expect(exists).toBe(true);
  });
});

describe('parseBooleanOption', () => {
  it('returns true for boolean true', () => {
    expect(parseBooleanOption(true)).toBe(true);
  });

  it('returns false for boolean false', () => {
    expect(parseBooleanOption(false)).toBe(false);
  });

  it('returns true for string "true"', () => {
    expect(parseBooleanOption('true')).toBe(true);
  });

  it('returns true for string "TRUE" (case insensitive)', () => {
    expect(parseBooleanOption('TRUE')).toBe(true);
  });

  it('returns true for string "True"', () => {
    expect(parseBooleanOption('True')).toBe(true);
  });

  it('returns true for string "1"', () => {
    expect(parseBooleanOption('1')).toBe(true);
  });

  it('returns true for string "yes"', () => {
    expect(parseBooleanOption('yes')).toBe(true);
  });

  it('returns true for string "YES"', () => {
    expect(parseBooleanOption('YES')).toBe(true);
  });

  it('returns true for string "y"', () => {
    expect(parseBooleanOption('y')).toBe(true);
  });

  it('returns true for string "Y"', () => {
    expect(parseBooleanOption('Y')).toBe(true);
  });

  it('returns false for string "false"', () => {
    expect(parseBooleanOption('false')).toBe(false);
  });

  it('returns false for string "0"', () => {
    expect(parseBooleanOption('0')).toBe(false);
  });

  it('returns false for string "no"', () => {
    expect(parseBooleanOption('no')).toBe(false);
  });

  it('returns true for number 1', () => {
    expect(parseBooleanOption(1)).toBe(true);
  });

  it('returns false for number 0', () => {
    expect(parseBooleanOption(0)).toBe(false);
  });

  it('returns false for number 2', () => {
    expect(parseBooleanOption(2)).toBe(false);
  });

  it('returns false for null', () => {
    expect(parseBooleanOption(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(parseBooleanOption(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(parseBooleanOption('')).toBe(false);
  });

  it('returns false for object', () => {
    expect(parseBooleanOption({})).toBe(false);
  });

  it('returns false for array', () => {
    expect(parseBooleanOption([])).toBe(false);
  });
});
