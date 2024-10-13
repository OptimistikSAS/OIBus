import ivm from 'isolated-vm';
import pino from 'pino';
import SandboxService from './sandbox.service';
import { OIBusContent } from '../../../shared/model/engine.model';
import { TransformerDTO } from '../../../shared/model/transformer.model';
import PinoLogger from '../tests/__mocks__/logger.mock';

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

const logger: pino.Logger = new PinoLogger();

const testData: OIBusContent = {
  type: 'time-values',
  content: [
    {
      data: { value: 'data1' },
      pointId: 'pointId',
      timestamp: 'ts'
    },
    {
      data: { value: 'data2' },
      pointId: 'pointId',
      timestamp: 'ts'
    }
  ]
};
const testCode = `
  function transform(inputData) {
    return {
      type: 'file-content',
      data: inputData.content.map(c => c.data.value)
    };
  }
`;
const expectedData = {
  type: 'file-content',
  data: ['data1', 'data2']
};

const testTransformer: TransformerDTO = {
  id: '123456',
  name: 'name',
  description: 'description',
  inputType: 'input',
  outputType: 'output',
  code: testCode,
  fileRegex: 'fileRegex'
};

describe('SandboxService with mocked ivm', () => {
  let sandboxService: SandboxService;

  beforeEach(() => {
    jest.clearAllMocks();

    context.global.derefInto.mockReturnValue({ foo: 'bar' });
    transformFnRef.apply.mockReturnValue(expectedData);
    context.global.get.mockReturnValue(transformFnRef);

    sandboxService = new SandboxService(logger);
  });

  it('should execute the transformer code and return the result', async () => {
    const result = await sandboxService.execute(testTransformer, testData);

    expect(compileScript).toHaveBeenCalled();
    expect(context.global.set).toHaveBeenCalledWith('global', globalDeref);
    expect(script.run).toHaveBeenCalledWith(context);
    expect(context.global.get).toHaveBeenCalledWith('transform', { reference: true });
    expect(transformFnRef.apply).toHaveBeenCalledWith(undefined, [testData], {
      arguments: { copy: true },
      result: { copy: true, promise: true }
    });

    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toEqual(expectedData);
  });
});

describe('SandboxService with actual ivm', () => {
  let sandboxService: SandboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    // restore the original version of the isolate
    // in case any other lib is used by the SandboxService, it needs to be restored manually
    ivm.Isolate = originalIsolate;
    sandboxService = new SandboxService(logger);
  });

  it('should execute the transformer code and return the result', async () => {
    const result = await sandboxService.execute(testTransformer, testData);

    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toEqual(expectedData);
  });

  it('should return null when the code is not syntactically valid', async () => {
    const transformer = { ...testTransformer };
    transformer.code += '1234xyz';
    const result = await sandboxService.execute(transformer, testData);

    // expect the error passed as the second parameter to have a syntax error
    expect((logger.error as jest.Mock).mock.calls[0][1].message).toEqual('Invalid or unexpected token [<isolated-vm>:8:1]');
    expect(result).toEqual(null);
  });

  it('should return null when there is no transform function', async () => {
    const transformer = { ...testTransformer };
    transformer.code = `const foo = 'bar';`;
    const result = await sandboxService.execute(transformer, testData);

    expect((logger.error as jest.Mock).mock.calls[0][1].message).toEqual('Reference is not a function');
    expect(result).toEqual(null);
  });

  it('should return null when the transformer does not return transferable data', async () => {
    const transformer = { ...testTransformer };
    transformer.code = `
      function transform(inputData) {
        return {
          type: 'file-content',
          data: () => {}
        };
      }
    `;
    const result = await sandboxService.execute(transformer, testData);

    expect((logger.error as jest.Mock).mock.calls[0][1].message).toEqual('() => {} could not be cloned.');
    expect(result).toEqual(null);
  });
});
