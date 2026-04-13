import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
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

    assert.ok(result.includes('--config'));
    assert.ok(result.includes(absolutePath));
    const configIndex = result.indexOf('--config');
    assert.strictEqual(result[configIndex + 1], absolutePath);
  });

  it('adds --launcherVersion when --config is present', () => {
    const args = ['node', 'script.js', '--config', './data-folder'];
    const absolutePath = '/absolute/path/to/data-folder';
    const result = replaceConfigArgumentWithAbsolutePath(args, absolutePath);

    assert.ok(result.includes('--launcherVersion'));
  });

  it('does not modify args when --config is not present', () => {
    const args = ['node', 'script.js', '--other', 'value'];
    const absolutePath = '/absolute/path/to/data-folder';
    const result = replaceConfigArgumentWithAbsolutePath(args, absolutePath);

    assert.ok(result.includes('--launcherVersion'));
    assert.ok(!result.includes('--config'));
  });

  it('handles multiple --config occurrences by replacing the first one', () => {
    const args = ['node', 'script.js', '--config', './data1', '--config', './data2'];
    const absolutePath = '/absolute/path';
    const result = replaceConfigArgumentWithAbsolutePath(args, absolutePath);

    const firstConfigIndex = result.indexOf('--config');
    assert.strictEqual(result[firstConfigIndex + 1], absolutePath);
  });
});

describe('removeLauncherOnlyArguments', () => {
  it('removes --reset-password flag', () => {
    const args = ['node', 'script.js', '--config', './data', '--reset-password', 'true'];
    const result = removeLauncherOnlyArguments(args);

    assert.ok(!result.includes('--reset-password'));
    assert.ok(result.includes('--config'));
  });

  it('removes --reset-password=value format', () => {
    const args = ['node', 'script.js', '--config', './data', '--reset-password=true'];
    const result = removeLauncherOnlyArguments(args);

    assert.ok(!result.includes('--reset-password=true'));
    assert.ok(result.includes('--config'));
  });

  it('removes --reset-password and its value when separate', () => {
    const args = ['node', 'script.js', '--reset-password', 'true', '--config', './data'];
    const result = removeLauncherOnlyArguments(args);

    assert.ok(!result.includes('--reset-password'));
    assert.ok(!result.includes('true'));
    assert.ok(result.includes('--config'));
  });

  it('does not remove value if it looks like another flag', () => {
    const args = ['node', 'script.js', '--reset-password', '--other-flag'];
    const result = removeLauncherOnlyArguments(args);

    assert.ok(!result.includes('--reset-password'));
    assert.ok(result.includes('--other-flag'));
  });

  it('preserves other arguments', () => {
    const args = ['node', 'script.js', '--config', './data', '--check', '--other', 'value'];
    const result = removeLauncherOnlyArguments(args);

    assert.ok(result.includes('--config'));
    assert.ok(result.includes('--check'));
    assert.ok(result.includes('--other'));
    assert.ok(result.includes('value'));
  });

  it('handles empty array', () => {
    const args: Array<string> = [];
    const result = removeLauncherOnlyArguments(args);

    assert.deepStrictEqual(result, []);
  });
});

describe('delay', () => {
  it('resolves after the specified timeout', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;

    assert.ok(elapsed >= 45);
    assert.ok(elapsed < 100);
  });
});

describe('createFolder', () => {
  it('creates a folder if it does not exist', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const folderPath = path.join(tempDir, 'new-folder');

    await createFolder(folderPath);

    assert.ok(fs.existsSync(folderPath));
    assert.ok(fs.statSync(folderPath).isDirectory());
  });

  it('does not throw if folder already exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const folderPath = path.join(tempDir, 'existing-folder');
    fs.mkdirSync(folderPath, { recursive: true });

    await assert.doesNotReject(createFolder(folderPath));
    assert.ok(fs.existsSync(folderPath));
  });

  it('creates nested folders recursively', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const folderPath = path.join(tempDir, 'level1', 'level2', 'level3');

    await createFolder(folderPath);

    assert.ok(fs.existsSync(folderPath));
    assert.ok(fs.statSync(folderPath).isDirectory());
  });
});

describe('filesExists', () => {
  it('returns true if file exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const filePath = path.join(tempDir, 'test-file.txt');
    fs.writeFileSync(filePath, 'test content');

    const exists = await filesExists(filePath);

    assert.strictEqual(exists, true);
  });

  it('returns false if file does not exist', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const filePath = path.join(tempDir, 'non-existent-file.txt');

    const exists = await filesExists(filePath);

    assert.strictEqual(exists, false);
  });

  it('returns true if directory exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-utils-'));
    createdDirectories.push(tempDir);
    const dirPath = path.join(tempDir, 'test-dir');
    fs.mkdirSync(dirPath);

    const exists = await filesExists(dirPath);

    assert.strictEqual(exists, true);
  });
});

describe('parseBooleanOption', () => {
  it('returns true for boolean true', () => {
    assert.strictEqual(parseBooleanOption(true), true);
  });

  it('returns false for boolean false', () => {
    assert.strictEqual(parseBooleanOption(false), false);
  });

  it('returns true for string "true"', () => {
    assert.strictEqual(parseBooleanOption('true'), true);
  });

  it('returns true for string "TRUE" (case insensitive)', () => {
    assert.strictEqual(parseBooleanOption('TRUE'), true);
  });

  it('returns true for string "True"', () => {
    assert.strictEqual(parseBooleanOption('True'), true);
  });

  it('returns true for string "1"', () => {
    assert.strictEqual(parseBooleanOption('1'), true);
  });

  it('returns true for string "yes"', () => {
    assert.strictEqual(parseBooleanOption('yes'), true);
  });

  it('returns true for string "YES"', () => {
    assert.strictEqual(parseBooleanOption('YES'), true);
  });

  it('returns true for string "y"', () => {
    assert.strictEqual(parseBooleanOption('y'), true);
  });

  it('returns true for string "Y"', () => {
    assert.strictEqual(parseBooleanOption('Y'), true);
  });

  it('returns false for string "false"', () => {
    assert.strictEqual(parseBooleanOption('false'), false);
  });

  it('returns false for string "0"', () => {
    assert.strictEqual(parseBooleanOption('0'), false);
  });

  it('returns false for string "no"', () => {
    assert.strictEqual(parseBooleanOption('no'), false);
  });

  it('returns true for number 1', () => {
    assert.strictEqual(parseBooleanOption(1), true);
  });

  it('returns false for number 0', () => {
    assert.strictEqual(parseBooleanOption(0), false);
  });

  it('returns false for number 2', () => {
    assert.strictEqual(parseBooleanOption(2), false);
  });

  it('returns false for null', () => {
    assert.strictEqual(parseBooleanOption(null), false);
  });

  it('returns false for undefined', () => {
    assert.strictEqual(parseBooleanOption(undefined), false);
  });

  it('returns false for empty string', () => {
    assert.strictEqual(parseBooleanOption(''), false);
  });

  it('returns false for object', () => {
    assert.strictEqual(parseBooleanOption({}), false);
  });

  it('returns false for array', () => {
    assert.strictEqual(parseBooleanOption([]), false);
  });
});
