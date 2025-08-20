import ivm from 'isolated-vm';
import pino from 'pino';
import SandboxService from './sandbox.service';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { CustomTransformer } from '../model/transformer.model';
import { OIBusObjectAttribute } from '../../shared/model/form.model';

// Javascript sandbox mock
const transformFnRef = { apply: jest.fn() };
const globalDeref = { foo: 'bar' };
const script = {
  run: jest.fn()
};
const compileScript = jest.fn(() => script);
const context = {
  global: {
    set: jest.fn(),
    get: jest.fn(),
    derefInto: jest.fn(() => globalDeref)
  },
  release: jest.fn()
};
const createContext = jest.fn(() => context);
const { Isolate: originalIsolate } = jest.requireActual('isolated-vm');
jest.mock('isolated-vm', () => ({
  Isolate: function () {
    return {
      compileScript,
      createContext
    };
  }
}));

// Mock Pyodide
const mockRunPython = jest.fn();
const loadedPyodide = {
  runPython: mockRunPython,
  loadedPackages: new Set(),
  loadPackage: jest.fn()
};
jest.mock('pyodide', () => {
  const mockLoadPyodide = jest.fn(() => Promise.resolve(loadedPyodide));
  return {
    loadPyodide: mockLoadPyodide
  };
});

const logger: pino.Logger = new PinoLogger();

describe('Sandbox for Javascript', () => {
  const testCode = `
    function transform(stringContent, source, filename, options) {
      return {
        filename,
        data: stringContent
      };
    }
  `;
  const expectedData = {
    metadata: {
      contentFile: 'my-file.txt',
      contentSize: 0,
      contentType: 'output',
      createdAt: '',
      numberOfElement: 0,
      options: {},
      source: 'source'
    },
    output: '"data"'
  };

  const testTransformer: CustomTransformer = {
    id: '123456',
    type: 'custom',
    name: 'name',
    description: 'description',
    inputType: 'input',
    outputType: 'output',
    language: 'javascript',
    customCode: testCode,
    customManifest: {} as OIBusObjectAttribute
  };

  describe('with mocked ivm', () => {
    let sandboxService: SandboxService;

    beforeEach(() => {
      jest.clearAllMocks();

      context.global.derefInto.mockReturnValue({ foo: 'bar' });
      transformFnRef.apply.mockReturnValue({
        data: 'data',
        filename: expectedData.metadata.contentFile,
        numberOfElement: expectedData.metadata.numberOfElement
      });
      context.global.get.mockReturnValue(transformFnRef);

      sandboxService = new SandboxService(logger);
    });

    it('should execute the transformer code and return the result', async () => {
      transformFnRef.apply
        .mockReturnValueOnce({
          data: undefined,
          filename: expectedData.metadata.contentFile
        })
        .mockReturnValueOnce(undefined);
      await expect(sandboxService.execute('data', 'source', 'my-file.txt', testTransformer, {})).rejects.toThrow(
        `Transform function did not return a valid result: ${JSON.stringify({
          data: undefined,
          filename: expectedData.metadata.contentFile
        })}`
      );
      await expect(sandboxService.execute('data', 'source', 'my-file.txt', testTransformer, {})).rejects.toThrow(
        `Transform function did not return a valid result: ${JSON.stringify(undefined)}`
      );
    });

    it('should execute the transformer code and throw error if no valid the result', async () => {
      const result = await sandboxService.execute('data', 'source', 'my-file.txt', testTransformer, {});

      expect(compileScript).toHaveBeenCalled();
      expect(context.global.set).toHaveBeenCalledWith('global', globalDeref);
      expect(script.run).toHaveBeenCalledWith(context);
      expect(context.global.get).toHaveBeenCalledWith('transform', { reference: true });
      expect(transformFnRef.apply).toHaveBeenCalledWith(undefined, ['data', 'source', 'my-file.txt', {}], {
        arguments: { copy: true },
        result: { copy: true, promise: true },
        timeout: 5000
      });

      expect(logger.error).not.toHaveBeenCalled();
      expect(result).toEqual(expectedData);
    });
  });

  describe('with actual ivm', () => {
    let sandboxService: SandboxService;

    beforeEach(() => {
      jest.clearAllMocks();
      // restore the original version of the isolate
      // in case any other lib is used by the SandboxService, it needs to be restored manually
      ivm.Isolate = originalIsolate;
      sandboxService = new SandboxService(logger);
    });

    it('should execute the transformer code and return the result', async () => {
      const result = await sandboxService.execute('data', 'source', 'my-file.txt', testTransformer, {});

      expect(logger.error).not.toHaveBeenCalled();
      expect(result).toEqual(expectedData);
    });

    it('should return null when the code is not syntactically valid', async () => {
      const transformer = { ...testTransformer };
      transformer.customCode += '1234xyz';
      await expect(sandboxService.execute('data', 'source', 'my-file.txt', transformer, {})).rejects.toThrow(
        'Invalid or unexpected token [<isolated-vm>:8:3]'
      );
    });

    it('should return null when there is no transform function', async () => {
      const transformer = { ...testTransformer };
      transformer.customCode = `const foo = 'bar';`;
      await expect(sandboxService.execute('data', 'source', 'my-file.txt', transformer, {})).rejects.toThrow('Reference is not a function');
    });

    it('should throw error when the transformer does not return transferable data', async () => {
      const transformer = { ...testTransformer };
      transformer.customCode = `
      function transform(stringContent, source, filename, options) {
        return {
          type: 'file-content',
          data: () => {}
        };
      }
    `;
      await expect(sandboxService.execute('data', 'source', 'my-file.txt', transformer, {})).rejects.toThrow(
        '() => {} could not be cloned.'
      );
    });
  });
});

describe('Sandbox for Python', () => {
  const testCode = `
def transform(content, filename, source, options):
    import json
    data = json.loads(content)
    return {
        'data': data,
        'filename': filename,
        'numberOfElement': len(data) if isinstance(data, list) else 1
    }
`;
  const expectedData = {
    metadata: {
      contentFile: 'my-file.txt',
      contentSize: 0,
      contentType: 'output',
      createdAt: '',
      numberOfElement: 1,
      options: {},
      source: 'source'
    },
    output: '"data"' // JSON.stringify('data') would be '"data"'
  };
  const testTransformer: CustomTransformer = {
    id: '123456',
    type: 'custom',
    name: 'name',
    description: 'description',
    inputType: 'input',
    outputType: 'output',
    language: 'python',
    customCode: testCode,
    customManifest: {} as OIBusObjectAttribute
  };

  let sandboxService: SandboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    sandboxService = new SandboxService(logger);
  });

  describe('with mocked pyodide', () => {
    beforeEach(() => {
      // Mock successful execution
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockResolvedValue({
        runPython: mockRunPython.mockImplementation((code: string) => {
          if (code.includes('call_transform()')) {
            return JSON.stringify({
              data: 'data',
              filename: 'my-file.txt',
              numberOfElement: 1
            });
          }
          return '';
        })
      });
    });

    it('should initialize Pyodide only once', async () => {
      await sandboxService.execute('"data"', 'source', 'my-file.txt', testTransformer, {});
      await sandboxService.execute('"data"', 'source', 'my-file.txt', testTransformer, {});
      expect(jest.requireMock('pyodide').loadPyodide).toHaveBeenCalledTimes(1);
    });

    it('should execute the transformer code and return the result', async () => {
      const result = await sandboxService.execute('"data"', 'source', 'my-file.txt', testTransformer, {});
      // Verify Pyodide was initialized
      expect(jest.requireMock('pyodide').loadPyodide).toHaveBeenCalledWith({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/'
      });
      // Verify the setup code was run
      expect(mockRunPython.mock.calls[0][0]).toContain('import json');
      expect(mockRunPython.mock.calls[0][0]).toContain('content = json.loads');
      // Verify the transform code was run
      expect(mockRunPython.mock.calls[1][0]).toContain('def call_transform():');
      // Verify the result
      expect(result).toEqual(expectedData);
    });

    it('should handle Python execution errors', async () => {
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockResolvedValueOnce({
        runPython: mockRunPython.mockImplementation((code: string) => {
          if (code.includes('call_transform()')) {
            return JSON.stringify({
              error: 'Test error',
              filename: 'my-file.txt',
              numberOfElement: 0
            });
          }
          return '';
        })
      });
      await expect(sandboxService.execute('"data"', 'source', 'my-file.txt', testTransformer, {})).rejects.toThrow(
        'Python execution error: Test error'
      );
    });

    it('should handle invalid JSON in Python output', async () => {
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockResolvedValueOnce({
        runPython: mockRunPython.mockReturnValue('invalid json')
      });
      await expect(sandboxService.execute('"data"', 'source', 'my-file.txt', testTransformer, {})).rejects.toThrow(
        'Unexpected token \'i\', "invalid json" is not valid JSON'
      );
    });

    it('should handle Pyodide initialization failure', async () => {
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockRejectedValueOnce(new Error('Failed to load Pyodide'));
      await expect(sandboxService.execute('"data"', 'source', 'my-file.txt', testTransformer, {})).rejects.toThrow(
        'Failed to load Pyodide'
      );
    });

    it('should handle missing Pyodide instance', async () => {
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockResolvedValueOnce(undefined);
      await expect(sandboxService.execute('"data"', 'source', 'my-file.txt', testTransformer, {})).rejects.toThrow(
        'Pyodide not initialized'
      );
    });

    it('should pass correct arguments to Python code', async () => {
      const options = { key: 'value' };
      await sandboxService.execute('"data"', 'source', 'my-file.txt', testTransformer, options);
      // Verify the arguments were set correctly
      const setupCall = mockRunPython.mock.calls[0][0];
      expect(setupCall).toContain(`content = json.loads(r'''"\\"data\\""''')`);
      expect(setupCall).toContain(`filename = "my-file.txt"`);
      expect(setupCall).toContain(`source = "source"`);
      expect(setupCall).toContain(`options = json.loads(r'''${JSON.stringify(options)}''')`);
    });

    it('should handle null filename', async () => {
      const result = await sandboxService.execute('"data"', 'source', null, testTransformer, {});
      // Verify the filename was handled correctly
      const setupCall = mockRunPython.mock.calls[0][0];
      expect(setupCall).toContain('filename = None');
      // Verify the result still has a default filename
      expect(result.metadata.contentFile).toBeDefined();
    });

    it('should handle complex data structures', async () => {
      const complexData = '{"key": "value", "array": [1, 2, 3]}';
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockResolvedValueOnce({
        runPython: mockRunPython.mockImplementation((code: string) => {
          if (code.includes('call_transform()')) {
            return JSON.stringify({
              data: { key: 'value', array: [1, 2, 3] },
              filename: 'my-file.txt',
              numberOfElement: 3
            });
          }
          return '';
        })
      });
      const result = await sandboxService.execute(complexData, 'source', 'my-file.txt', testTransformer, {});
      expect(result.output).toEqual(JSON.stringify({ key: 'value', array: [1, 2, 3] }));
      expect(result.metadata.numberOfElement).toBe(3);
    });
  });

  describe('Python code variations', () => {
    it('should handle Python code that returns a list', async () => {
      const listTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
def transform(content, filename, source, options):
    import json
    data = json.loads(content)
    return {
        'data': data['array'],
        'filename': filename,
        'numberOfElement': len(data['array'])
    }
`
      };
      const inputData = '{"array": [1, 2, 3, 4, 5]}';
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockResolvedValueOnce({
        runPython: mockRunPython.mockImplementation((code: string) => {
          if (code.includes('call_transform()')) {
            return JSON.stringify({
              data: [1, 2, 3, 4, 5],
              filename: 'my-file.txt',
              numberOfElement: 5
            });
          }
          return '';
        })
      });
      const result = await sandboxService.execute(inputData, 'source', 'my-file.txt', listTransformer, {});
      expect(result.output).toEqual('[1,2,3,4,5]');
      expect(result.metadata.numberOfElement).toBe(5);
    });

    it('should handle Python code that modifies data', async () => {
      const modifyTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
def transform(content, filename, source, options):
    import json
    data = json.loads(content)
    return {
        'data': {**data, 'modified': True},
        'filename': filename,
        'numberOfElement': 0
    }
`
      };
      const inputData = '{"key": "value"}';
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockResolvedValueOnce({
        runPython: mockRunPython.mockImplementation((code: string) => {
          if (code.includes('call_transform()')) {
            return JSON.stringify({
              data: { key: 'value', modified: true },
              filename: 'my-file.txt',
              numberOfElement: 0
            });
          }
          return '';
        })
      });
      const result = await sandboxService.execute(inputData, 'source', 'my-file.txt', modifyTransformer, {});
      expect(result.output).toEqual('{"key":"value","modified":true}');
    });

    it('should handle Python syntax errors', async () => {
      const brokenTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
def transform(content, filename, source, options):
    this is invalid python code
    return {}
`
      };
      (jest.requireMock('pyodide').loadPyodide as jest.Mock).mockResolvedValueOnce({
        runPython: mockRunPython.mockImplementation((code: string) => {
          if (code.includes('call_transform()')) {
            return JSON.stringify({
              error: 'SyntaxError: invalid syntax',
              filename: 'my-file.txt',
              numberOfElement: 0
            });
          }
          return '';
        })
      });
      await expect(sandboxService.execute('"data"', 'source', 'my-file.txt', brokenTransformer, {})).rejects.toThrow(
        'Python execution error: SyntaxError: invalid syntax'
      );
    });
  });
});
