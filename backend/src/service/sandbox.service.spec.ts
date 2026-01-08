import ivm from 'isolated-vm';
import pino from 'pino';
import SandboxService from './sandbox.service';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { CustomTransformer } from '../model/transformer.model';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import ts from 'typescript';

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

// Mock TypeScript
jest.mock('typescript', () => ({
  transpile: jest.fn(),
  ScriptTarget: {
    ES2022: 9
  },
  ModuleKind: {
    ESNext: 99
  },
  JsxEmit: {
    Preserve: 1
  }
}));

const actualTs = jest.requireActual('typescript');
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
      numberOfElement: 0
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
      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', testTransformer, {})).rejects.toThrow(
        `Transform function did not return a valid result: ${JSON.stringify({
          data: undefined,
          filename: expectedData.metadata.contentFile
        })}`
      );
      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', testTransformer, {})).rejects.toThrow(
        `Transform function did not return a valid result: ${JSON.stringify(undefined)}`
      );
    });

    it('should execute the transformer code and throw error if no valid the result', async () => {
      const result = await sandboxService.execute('data', { source: 'test' }, 'my-file.txt', testTransformer, {});

      expect(compileScript).toHaveBeenCalled();
      expect(context.global.set).toHaveBeenCalledWith('global', globalDeref);
      expect(script.run).toHaveBeenCalledWith(context);
      expect(context.global.get).toHaveBeenCalledWith('transform', { reference: true });
      expect(transformFnRef.apply).toHaveBeenCalledWith(undefined, ['data', { source: 'test' }, 'my-file.txt', {}], {
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
      const result = await sandboxService.execute('data', { source: 'test' }, 'my-file.txt', testTransformer, {});

      expect(logger.error).not.toHaveBeenCalled();
      expect(result).toEqual(expectedData);
    });

    it('should return null when the code is not syntactically valid', async () => {
      const transformer = { ...testTransformer };
      transformer.customCode += '1234xyz';
      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', transformer, {})).rejects.toThrow(
        'Invalid or unexpected token [<isolated-vm>:8:3]'
      );
    });

    it('should return null when there is no transform function', async () => {
      const transformer = { ...testTransformer };
      transformer.customCode = `const foo = 'bar';`;
      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', transformer, {})).rejects.toThrow(
        'Reference is not a function'
      );
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
      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', transformer, {})).rejects.toThrow(
        '() => {} could not be cloned.'
      );
    });
  });
});

describe('Sandbox for TypeScript', () => {
  const testCode = `
    interface TransformResult {
      data: any;
      filename: string;
      numberOfElement?: number;
    }

    function transform(stringContent: string, source: string, filename: string, options: any): TransformResult {
      return {
        filename,
        data: stringContent,
        numberOfElement: 1
      };
    }
  `;
  const expectedData = {
    metadata: {
      contentFile: 'my-file.txt',
      contentSize: 0,
      contentType: 'output',
      createdAt: '',
      numberOfElement: 1
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
    language: 'typescript',
    customCode: testCode,
    customManifest: {} as OIBusObjectAttribute
  };

  let sandboxService: SandboxService;
  const mockTranspile = jest.requireMock('typescript').transpile as jest.Mock;
  const ts = jest.requireActual('typescript');

  beforeEach(() => {
    jest.clearAllMocks();
    mockTranspile.mockImplementation((code: string, options: ts.TranspileOptions) => {
      return actualTs.transpile(code, options);
    });
    sandboxService = new SandboxService(logger);
  });

  describe('with mocked ivm', () => {
    beforeEach(() => {
      context.global.derefInto.mockReturnValue({ foo: 'bar' });
      transformFnRef.apply.mockReturnValue({
        data: 'data',
        filename: expectedData.metadata.contentFile,
        numberOfElement: expectedData.metadata.numberOfElement
      });
      context.global.get.mockReturnValue(transformFnRef);
    });

    it('should handle TypeScript with complex types', async () => {
      const complexTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
          interface ComplexData {
            items: Array<{ id: number; name: string; value: number }>;
            metadata: { timestamp: number; version: string };
          }

          interface ProcessedData {
            total: number;
            average: number;
            items: Array<{ id: number; name: string; value: number; doubled: number }>;
            metadata: { timestamp: number; version: string; processed: boolean };
          }

          function transform(content: string, source: string, filename: string, options: any) {
            const data: ComplexData = JSON.parse(content);
            const total = data.items.reduce((sum, item) => sum + item.value, 0);
            const average = data.items.length > 0 ? total / data.items.length : 0;

            const processedData: ProcessedData = {
              total,
              average,
              items: data.items.map(item => ({
                ...item,
                doubled: item.value * 2
              })),
              metadata: {
                ...data.metadata,
                processed: true
              }
            };

            return {
              data: processedData,
              filename: filename,
              numberOfElement: data.items.length
            };
          }
        `
      };

      const inputData = {
        items: [
          { id: 1, name: 'item1', value: 10 },
          { id: 2, name: 'item2', value: 20 }
        ],
        metadata: { timestamp: Date.now(), version: '1.0' }
      };

      transformFnRef.apply.mockReturnValue({
        data: {
          total: 30,
          average: 15,
          items: [
            { id: 1, name: 'item1', value: 10, doubled: 20 },
            { id: 2, name: 'item2', value: 20, doubled: 40 }
          ],
          metadata: { timestamp: inputData.metadata.timestamp, version: '1.0', processed: true }
        },
        filename: 'my-file.txt',
        numberOfElement: 2
      });

      const result = await sandboxService.execute(JSON.stringify(inputData), { source: 'test' }, 'my-file.txt', complexTransformer, {});

      expect(result).toBeDefined();
      const outputData = JSON.parse(result.output);
      expect(outputData.total).toBe(30);
      expect(outputData.average).toBe(15);
      expect(outputData.items).toHaveLength(2);
      expect(outputData.items[0].doubled).toBe(20);
      expect(outputData.metadata.processed).toBe(true);
    });

    it('should handle TypeScript with type annotations', async () => {
      const typedTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
          interface InputData {
            value: number;
            name: string;
          }

          interface OutputData {
            processedValue: number;
            processedName: string;
            timestamp: number;
          }

          function transform(content: string, source: string, filename: string, options: any) {
            const inputData: InputData = JSON.parse(content);
            const outputData: OutputData = {
              processedValue: inputData.value * 2,
              processedName: inputData.name.toUpperCase(),
              timestamp: Date.now()
            };

            return {
              data: outputData,
              filename: filename,
              numberOfElement: 1
            };
          }
        `
      };

      transformFnRef.apply.mockReturnValue({
        data: {
          processedValue: 84,
          processedName: 'TEST',
          timestamp: 1234567890
        },
        filename: 'my-file.txt',
        numberOfElement: 1
      });

      const result = await sandboxService.execute(
        JSON.stringify({ value: 42, name: 'test' }),
        { source: 'test' },
        'my-file.txt',
        typedTransformer,
        {}
      );

      expect(result).toBeDefined();
      const outputData = JSON.parse(result.output);
      expect(outputData.processedValue).toBe(84);
      expect(outputData.processedName).toBe('TEST');
      expect(outputData.timestamp).toBeDefined();
      expect(typeof outputData.timestamp).toBe('number');
    });
  });

  describe('with actual ivm', () => {
    let sandboxService: SandboxService;

    beforeEach(() => {
      jest.clearAllMocks();
      ivm.Isolate = originalIsolate;
      // Use real TypeScript transpiler
      mockTranspile.mockImplementation((code: string, options: ts.TranspileOptions) => {
        return ts.transpile(code, options);
      });
      sandboxService = new SandboxService(logger);
    });

    it('should execute TypeScript transformer code and return the result', async () => {
      const result = await sandboxService.execute('data', { source: 'test' }, 'my-file.txt', testTransformer, {});

      expect(logger.error).not.toHaveBeenCalled();
      expect(result).toEqual(expectedData);
    });

    it('should handle TypeScript compilation errors with actual ivm', async () => {
      // Create a transformer with invalid TypeScript that will cause compilation to fail
      const brokenTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
          function transform(stringContent: string, source: string, filename: string, options: any) {
            // This will cause a TypeScript compilation error due to invalid syntax
            const data = JSON.parse(stringContent);
            return {
              data: data,
              filename: filename,
              numberOfElement: 1
            };
          // Missing closing brace - this should cause compilation to fail
        `
      };

      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', brokenTransformer, {})).rejects.toThrow();
    });

    it('should handle TypeScript transform function returning invalid data', async () => {
      const transformerWithInvalidReturn: CustomTransformer = {
        ...testTransformer,
        customCode: `
          function transform(stringContent: string, source: string, filename: string, options: any) {
            // Return invalid data to test error handling
            return {
              data: null,
              filename: filename,
              numberOfElement: 1
            };
          }
        `
      };

      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', transformerWithInvalidReturn, {})).rejects.toThrow(
        'Transform function did not return a valid result'
      );
    });

    it('should handle TypeScript compilation errors with real syntax error', async () => {
      const brokenTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
          function transform(stringContent: string, source: string, filename: string, options: any) {
            // This will cause a real TypeScript compilation error
            const data = JSON.parse(stringContent);
            return {
              data: data,
              filename: filename,
              numberOfElement: 1
            };
          // Missing closing brace - this should cause compilation to fail
        `
      };

      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', brokenTransformer, {})).rejects.toThrow();
    });

    it('should handle TypeScript compilation errors with invalid code', async () => {
      const brokenTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `invalid typescript syntax that will definitely fail compilation`
      };

      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', brokenTransformer, {})).rejects.toThrow();
    });

    it('should handle TypeScript compilation errors with module syntax', async () => {
      const brokenTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
          import { something } from 'nonexistent';
          function transform(stringContent: string, source: string, filename: string, options: any) {
            return { data: stringContent, filename, numberOfElement: 1 };
          }
        `
      };

      await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', brokenTransformer, {})).rejects.toThrow();
    });
  });

  describe('Additional coverage tests', () => {
    let sandboxService: SandboxService;

    beforeEach(() => {
      jest.clearAllMocks();
      ivm.Isolate = originalIsolate;
      sandboxService = new SandboxService(logger);
    });

    describe('TypeScript compilation error handling', () => {
      it('should handle non-Error TypeScript compilation errors', async () => {
        const brokenTransformer: CustomTransformer = {
          id: '123456',
          type: 'custom',
          name: 'name',
          description: 'description',
          inputType: 'input',
          outputType: 'output',
          language: 'typescript',
          customCode: `
            function transform(stringContent: string, source: string, filename: string, options: any) {
              return { data: stringContent, filename, numberOfElement: 1 };
            }
          `,
          customManifest: {} as OIBusObjectAttribute
        };

        // Mock ts.transpile to throw a non-Error object (string)
        mockTranspile.mockImplementationOnce(() => {
          throw 'String error instead of Error object';
        });

        await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', brokenTransformer, {})).rejects.toThrow(
          'TypeScript compilation failed: String error instead of Error object'
        );
      });

      it('should handle Error instance in TypeScript compilation', async () => {
        const brokenTransformer: CustomTransformer = {
          id: '123456',
          type: 'custom',
          name: 'name',
          description: 'description',
          inputType: 'input',
          outputType: 'output',
          language: 'typescript',
          customCode: `
            function transform(stringContent: string, source: string, filename: string, options: any) {
              return { data: stringContent, filename, numberOfElement: 1 };
            }
          `,
          customManifest: {} as OIBusObjectAttribute
        };

        // Mock ts.transpile to throw an Error object
        mockTranspile.mockImplementationOnce(() => {
          throw new Error('Compilation error message');
        });

        await expect(sandboxService.execute('data', { source: 'test' }, 'my-file.txt', brokenTransformer, {})).rejects.toThrow(
          'TypeScript compilation failed: Compilation error message'
        );
      });

      it('should successfully compile and execute valid TypeScript', async () => {
        const validTransformer: CustomTransformer = {
          id: '123456',
          type: 'custom',
          name: 'name',
          description: 'description',
          inputType: 'input',
          outputType: 'output',
          language: 'typescript',
          customCode: `
            function transform(stringContent: string, source: string, filename: string, options: any) {
              return { data: stringContent, filename, numberOfElement: 1 };
            }
          `,
          customManifest: {} as OIBusObjectAttribute
        };

        // Mock ts.transpile to return valid JavaScript
        mockTranspile.mockImplementationOnce((_code: string) => {
          return `
            function transform(stringContent, source, filename, options) {
              return { data: stringContent, filename, numberOfElement: 1 };
            }
          `;
        });

        const result = await sandboxService.execute('test data', { source: 'test' }, 'my-file.txt', validTransformer, {});
        expect(result.output).toBe('"test data"');
        expect(result.metadata.numberOfElement).toBe(1);
      });
    });

    describe('JavaScript error handling edge cases', () => {
      it('should handle JavaScript code that returns result without numberOfElement', async () => {
        const jsTransformer: CustomTransformer = {
          id: '123456',
          type: 'custom',
          name: 'name',
          description: 'description',
          inputType: 'input',
          outputType: 'output',
          language: 'javascript',
          customCode: `
            function transform(stringContent, source, filename, options) {
              return {
                data: stringContent,
                filename: filename
              };
            }
          `,
          customManifest: {} as OIBusObjectAttribute
        };

        const result = await sandboxService.execute('test data', { source: 'test' }, 'my-file.txt', jsTransformer, {});
        expect(result.metadata.numberOfElement).toBe(0);
      });
    });

    it('should handle TypeScript code that returns result without numberOfElement', async () => {
      const tsTransformer: CustomTransformer = {
        ...testTransformer,
        customCode: `
          function transform(stringContent: string, source: string, filename: string, options: any) {
            return {
              data: stringContent,
              filename: filename
            };
          }
        `
      };

      const result = await sandboxService.execute('test data', { source: 'test' }, 'my-file.txt', tsTransformer, {});
      expect(result.metadata.numberOfElement).toBe(0);
    });
  });
});
