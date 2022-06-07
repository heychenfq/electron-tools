import path from 'path';
import fs from 'fs';
import { Extractor, ExtractorConfig, ExtractorResult } from '@microsoft/api-extractor';
import { CustomizePromise, normalizeOptionsAndContext, EsLibcContext, EsLibcOptions, logger, isWindows } from './utils';
import { spawn } from 'child_process';

export async function dts(options?: EsLibcOptions, ctx?: EsLibcContext): Promise<void> {
  const [finalOptions, finalCtx] = normalizeOptionsAndContext(options, ctx);
  logger.info(`${finalCtx.packageInfo.name} --> Start to bundle declaration file.`);
  try {
    await generateDts(finalOptions, finalCtx);
    await rollupDts(finalOptions, finalCtx);
    logger.success(`${finalCtx.packageInfo.name} --> Bundle declaration file completed.`);
  } catch (e: any) {
    logger.error(`${finalCtx.packageInfo.name} --> Bundle declaration files completed with error: ${e.message}`);
  }
}

async function generateDts(options: Required<EsLibcOptions>, ctx: Required<EsLibcContext>): Promise<void> {
  // compile with tsc first to generate .d.ts file
  const tmpDir = path.resolve(ctx.projectRoot, '.eslibc');
  const tscProcess = spawn(
    path.resolve(__dirname, isWindows() ? '../node_modules/.bin/tsc.cmd' : '../node_modules/.bin/tsc'),
    [
      '-p',
      options.esbuild.tsconfig!,
      '--declarationDir',
      path.resolve(tmpDir, 'types'),
      '--emitDeclarationOnly',
      '--declarationMap',
      'false',
    ],
    {
      cwd: ctx.cwd,
      stdio: 'inherit',
    },
  );
  const tscPromise = new CustomizePromise();
  tscProcess.on('exit', (code) => {
    if (code && code !== 0) {
      throw new Error(`Compile sources exit with error, error code: ${code}`);
    } else {
      tscPromise.resolve();
    }
  });
  return tscPromise.promise;
}

async function rollupDts(options: Required<EsLibcOptions>, ctx: Required<EsLibcContext>): Promise<void> {
  const tmpDir = path.resolve(ctx.projectRoot, '.eslibc');
  const tsRootDir = path.resolve(ctx.projectRoot, ctx.tsCompilerOptions.rootDir || '.');
  const absEntryPath = path.resolve(ctx.projectRoot, options.entry);
  const sourceEntryRelativePath = path.relative(tsRootDir, absEntryPath).replace(/\.tsx?$/, '.d.ts');
  let outputDir = '';
  if (ctx.tsCompilerOptions.declarationDir) {
    outputDir = path.resolve(ctx.projectRoot, ctx.tsCompilerOptions.declarationDir);
  } else if (ctx.tsCompilerOptions.outDir) {
    outputDir = path.resolve(ctx.projectRoot, ctx.tsCompilerOptions.outDir);
  } else {
    throw new Error(
      'could not determine the output directory of declaration files, you should set one of outDir or declarationDir first',
    );
  }
  const dtsFilePath = path.resolve(outputDir, path.basename(sourceEntryRelativePath));
  const extractorConfigJSON = {
    $schema: 'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',
    projectFolder: ctx.projectRoot,
    mainEntryPointFilePath: path.resolve(tmpDir, 'types', sourceEntryRelativePath),
    bundledPackages: [],
    compiler: {
      tsconfigFilePath: options.esbuild.tsconfig,
      overrideTsconfig: {
        compilerOptions: {
          paths: Object.entries(ctx.tsCompilerOptions.paths || {}).reduce<Record<string, string[]>>(
            (paths, [key, mappings]) => {
              paths[key] = mappings.map((mapping) => {
                const dtsRelativePath = path.relative(
                  path.resolve(ctx.projectRoot, ctx.tsCompilerOptions.rootDir || '.'),
                  path.resolve(ctx.projectRoot, mapping),
                );
                return './' + path.relative(ctx.projectRoot, path.resolve(tmpDir, 'types', dtsRelativePath));
              });
              return paths;
            },
            {},
          ),
        },
      },
      skipLibCheck: false,
    },
    apiReport: {
      enabled: false,
    },
    docModel: {
      enabled: false,
    },
    dtsRollup: {
      enabled: true,
      untrimmedFilePath: dtsFilePath,
    },
    tsdocMetadata: {
      enabled: false,
    },
    messages: {
      compilerMessageReporting: {
        default: {
          logLevel: 'warning',
        },
      },
      extractorMessageReporting: {
        default: {
          logLevel: 'warning',
        },
      },
      tsdocMessageReporting: {
        default: {
          logLevel: 'warning',
        },
      },
    },
  };
  const configFilePath = path.resolve(tmpDir, 'api-extractor.json');
  fs.writeFileSync(configFilePath, JSON.stringify(extractorConfigJSON));
  // Load and parse the api-extractor.json file
  const extractorConfig: ExtractorConfig = ExtractorConfig.loadFileAndPrepare(configFilePath);

  // Invoke API Extractor
  const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
    // Equivalent to the "--local" command-line parameter
    localBuild: true,

    // Equivalent to the "--verbose" command-line parameter
    showVerboseMessages: true,
  });
  if (!extractorResult.succeeded) {
    throw new Error(
      `Bundle declaration completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`,
    );
  }
}
