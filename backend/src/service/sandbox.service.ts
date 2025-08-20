import ivm from 'isolated-vm';
import { loadPyodide, PyodideAPI } from 'pyodide';
import { Logger } from 'pino';
import { CustomTransformer } from '../model/transformer.model';
import { CacheMetadata } from '../../shared/model/engine.model';

interface ResultOutput<TOutput> {
  data: TOutput;
  filename: string;
  numberOfElement?: number;
}

export default class SandboxService {
  private isolate = new ivm.Isolate();
  private pyodideReady: Promise<PyodideAPI> | null = null;

  constructor(private readonly logger: Logger) {}

  /**
   * Initialise Pyodide (pour l'exécution de Python)
   */
  private async initializePyodide(): Promise<PyodideAPI> {
    if (!this.pyodideReady) {
      this.pyodideReady = loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/'
      });
      this.logger.info('Initializing Pyodide...');
      await this.pyodideReady;
      this.logger.info('Pyodide initialized');
    }
    return this.pyodideReady;
  }

  /**
   * Exécute du code dans une sandbox
   */
  public async execute<TOutput>(
    stringContent: string,
    source: string,
    filename: string | null,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    if (transformer.language === 'python') {
      return this.executePython<TOutput>(stringContent, source, filename, transformer, options);
    } else {
      return this.executeJavaScript<TOutput>(stringContent, source, filename, transformer, options);
    }
  }

  /**
   * Exécute du code JavaScript dans isolated-vm
   */
  private async executeJavaScript<TOutput>(
    stringContent: string,
    source: string,
    filename: string | null,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    let context: ivm.Context | null = null;
    try {
      const script = await this.isolate.compileScript(transformer.customCode);
      context = await this.isolate.createContext();

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

  /**
   * Exécute du code Python avec Pyodide
   */
  private async executePython<TOutput>(
    stringContent: string,
    source: string,
    filename: string | null,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    await this.initializePyodide();

    // Préparer le code Python avec une fonction transform
    const pythonCode = `
${transformer.customCode}

# Wrapper pour appeler la fonction transform
import json
import sys

def call_transform():
    try:
        # Récupérer les arguments depuis l'environnement global
        content = globals().get('content')
        filename_arg = globals().get('filename')
        source_arg = globals().get('source')
        options = globals().get('options') or {}

        # Appeler la fonction transform
        result = transform(content, filename_arg, source_arg, options)

        # Retourner le résultat sous forme de JSON
        return json.dumps({
            'data': result['data'],
            'filename': result.get('filename', '${filename || 'output.py'}'),
            'numberOfElement': result.get('numberOfElement', 0)
        })
    except Exception as e:
        return json.dumps({
            'error': str(e),
            'filename': '${filename || 'output.py'}',
            'numberOfElement': 0
        })
`;

    // Créer un environnement global pour Pyodide
    const pyodide = await this.pyodideReady;
    if (!pyodide) {
      throw new Error('Pyodide not initialized');
    }

    // Définir les variables globales pour le script Python
    pyodide.runPython(`
        import json
        content = json.loads(r'''${JSON.stringify(stringContent)}''')
        filename = ${filename ? JSON.stringify(filename) : 'None'}
        source = ${JSON.stringify(source)}
        options = json.loads(r'''${JSON.stringify(options)}''')
      `);

    // Exécuter le code Python
    const resultStr = pyodide.runPython(pythonCode);

    // Analyser le résultat
    const result = JSON.parse(resultStr);

    if (result.error) {
      throw new Error(`Python execution error: ${result.error}`);
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
