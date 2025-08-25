import ivm from 'isolated-vm';
import { loadPyodide } from 'pyodide';
import { Logger } from 'pino';
import { CustomTransformer } from '../model/transformer.model';
import { CacheMetadata } from '../../shared/model/engine.model';
import path from 'node:path';

interface ResultOutput<TOutput> {
  data: TOutput;
  filename: string;
  numberOfElement?: number;
}

export default class SandboxService {
  constructor(private readonly logger: Logger) {}

  public async execute<TOutput>(
    stringContent: string,
    source: string,
    filename: string,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    if (transformer.language === 'python') {
      return this.executePython<TOutput>(stringContent, source, filename, transformer, options);
    } else {
      return this.executeJavaScript<TOutput>(stringContent, source, filename, transformer, options);
    }
  }

  private async executeJavaScript<TOutput>(
    stringContent: string,
    source: string,
    filename: string,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    const isolate = new ivm.Isolate();
    let context: ivm.Context | null = null;
    try {
      const script = await isolate.compileScript(transformer.customCode);
      context = await isolate.createContext();

      const jail = context.global;
      await jail.set('global', jail.derefInto());
      await script.run(context);

      const transformFnRef = await jail.get('transform', { reference: true });

      const _result = (await transformFnRef.apply(undefined, [stringContent, source, filename, options], {
        arguments: { copy: true },
        result: { copy: true, promise: true },
        timeout: 5000
      })) as ResultOutput<TOutput>;

      if (!_result || !_result.data) {
        throw new Error(`Transform function did not return a valid result: ${JSON.stringify(_result)}`);
      }

      const result = {
        data: _result.data as TOutput,
        filename: _result.filename,
        numberOfElement: _result.numberOfElement || 0
      };

      return {
        output: JSON.stringify(result.data as TOutput),
        metadata: {
          contentFile: result.filename,
          contentSize: 0,
          createdAt: '',
          numberOfElement: result.numberOfElement || 0,
          contentType: transformer.outputType,
          source,
          options: {}
        }
      };
    } finally {
      if (context) {
        context.release();
      }
    }
  }

  private async executePython<TOutput>(
    stringContent: string,
    source: string,
    filename: string,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    const pyodide = await loadPyodide({
      indexURL: path.join(__dirname, '../../../../lib/pyodide'),
      packages: ['numpy', 'pandas', 'python-dateutil', 'pytz', 'six'],
      stdout: msg => this.logger.debug(msg),
      stderr: msg => this.logger.error(msg)
    });
    if (!pyodide) {
      throw new Error('Pyodide not initialized');
    }

    // Prepare the complete Python code with wrapper
    const completePythonCode = `
${transformer.customCode}

import json
import base64

def call_transform():
    try:
        # Retrieve global variables
        content_str = globals().get('content_str')
        filename_arg = globals().get('filename')
        source_arg = globals().get('source')
        options_str = globals().get('options_str')

        if not content_str:
            return json.dumps({
                'error': 'content_str is not defined',
                'filename': '${filename}'
            })

        # Decode content from base64
        try:
            content = json.loads(base64.b64decode(content_str).decode('utf-8'))
        except Exception as decode_error:
            return json.dumps({
                'error': f'Failed to decode content: {str(decode_error)}',
                'content_str': content_str[:100] if content_str else 'empty',
                'filename': '${filename}'
            })

        # Decode options from base64
        try:
            options = json.loads(base64.b64decode(options_str).decode('utf-8')) if options_str and options_str.strip() else {}
        except Exception as decode_error:
            return json.dumps({
                'error': f'Failed to decode options: {str(decode_error)}',
                'options_str': options_str[:100] if options_str else 'empty',
                'filename': '${filename}'
            })

        # Call the transform function from the custom code
        result = transform(content, filename_arg, source_arg, options)

        # Return the result as JSON
        if isinstance(result, dict):
            return json.dumps({
                'data': result.get('data', result),
                'filename': result.get('filename', '${filename}'),
                'numberOfElement': result.get('numberOfElement', 0)
            })
        else:
            return json.dumps({
                'data': result,
                'filename': '${filename}'
            })
    except Exception as e:
        import traceback
        return json.dumps({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'filename': '${filename}'
        })
  `;

    // Handle empty options object
    const optionsString = JSON.stringify(options);

    // Set up the global variables for the Python code
    // Objects are passed as base64 string to better manage python conversion
    await pyodide.runPythonAsync(`
    import json
    import base64

    content_str = "${Buffer.from(stringContent).toString('base64')}"
    filename = '${filename}'
    source = '${source}'
    options_str = "${optionsString === '{}' ? '' : Buffer.from(optionsString).toString('base64')}"
  `);

    // First run the complete Python code to define all functions
    await pyodide.runPythonAsync(completePythonCode);

    // Explicitly call the call_transform function and get its return value
    const resultStr = await pyodide.runPythonAsync(`
      result = call_transform()
      result
    `);
    if (!resultStr) {
      throw new Error('Python execution returned no result');
    }
    const result = JSON.parse(resultStr) as {
      data: TOutput;
      filename: string;
      numberOfElement?: number;
      error?: string;
      traceback?: string;
    };

    if (result.error) {
      throw new Error(`Python execution error: ${result.error}\n${result.traceback || ''}`);
    }

    if (!result.data) {
      throw new Error(`Transform function did not return a valid result: ${JSON.stringify(result)}`);
    }

    return {
      output: JSON.stringify(result.data as TOutput),
      metadata: {
        contentFile: result.filename,
        contentSize: 0,
        createdAt: '',
        numberOfElement: result.numberOfElement || 0,
        contentType: transformer.outputType,
        source,
        options: {}
      }
    };
  }
}
