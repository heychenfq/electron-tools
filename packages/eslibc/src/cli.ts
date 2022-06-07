import path from 'path';
import { program } from 'commander';
import { build, clean, dts, watch } from '.';
import { EsLibcOptions } from './utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageInfo = require('../package.json');

program.name(packageInfo.name).description(packageInfo.description).version(packageInfo.version);

program
  .command('build')
  .description('build library.')
  .argument('[entry-file]', 'the entry file start to build this library.')
  .option('-f, --formats [formats...]', 'output formats, supports cjs, esm, iife.')
  .option('-p, --project [project]', 'same as tsc --project option')
  .action((entry: string | undefined, options: { formats?: string[]; project?: string }) => {
    const buildOptions: EsLibcOptions = { esbuild: {} };
    if (entry) {
      buildOptions.entry = entry;
    }
    if (options.formats) {
      buildOptions.formats = options.formats as Array<'cjs' | 'esm' | 'iife'>;
    }
    if (options.project) {
      buildOptions.esbuild!.tsconfig = path.resolve(process.cwd(), options.project);
    }
    build(buildOptions);
  });

program
  .command('dev')
  .description('build library in watching mode.')
  .argument('[entry-file]', 'the entry file start to build this library.')
  .option('-f, --formats [string...]', 'output formats, supports cjs and esm')
  .option('-p, --project [project]', 'same as tsc --project option')
  .action((entry: string | undefined, options: { formats?: string[]; project?: string }) => {
    const buildOptions: EsLibcOptions = { esbuild: {} };
    if (entry) {
      buildOptions.entry = entry;
    }
    if (options.formats) {
      buildOptions.formats = options.formats as Array<'cjs' | 'esm' | 'iife'>;
    }
    if (options.project) {
      buildOptions.esbuild!.tsconfig = path.resolve(process.cwd(), options.project);
    }
    watch(buildOptions);
  });

program
  .command('dts')
  .description('generate declaration file.')
  .option('-p, --project [project]', 'same as tsc --project option')
  .action((options: { project?: string }) => {
    const buildOptions: EsLibcOptions = { esbuild: {} };
    if (options.project) {
      buildOptions.esbuild!.tsconfig = path.resolve(process.cwd(), options.project);
    }
    dts(buildOptions);
  });

program
  .command('clean')
  .description('clear the output directory and  temporary directory.')
  .option('-p, --project [project]', 'same as tsc --project option')
  .action((options: { project?: string }) => {
    const buildOptions: EsLibcOptions = { esbuild: {} };
    if (options.project) {
      buildOptions.esbuild!.tsconfig = path.resolve(process.cwd(), options.project);
    }
    clean(buildOptions);
  });

program.parse();
