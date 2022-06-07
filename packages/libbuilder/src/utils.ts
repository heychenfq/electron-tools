import path from 'path';
import fs from 'fs';
import json5 from 'json5';
import { CompilerOptions, findConfigFile, getDefaultCompilerOptions, sys } from 'typescript';
import colors from 'colors';
import { BuildOptions } from 'esbuild';

export interface LibBuilderOptions {
  entry?: string;
  formats?: Array<'cjs' | 'esm' | 'iife'>;
  esbuild?: Omit<BuildOptions, 'entryPoints' | 'entryNames'>;
}

interface PackageInfo {
  name: string;
  version: string;
  libbuilder?: LibBuilderOptions;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface LibBuilderContext {
  cwd?: string;
  projectRoot?: string;
  packageInfo?: PackageInfo;
  tsCompilerOptions?: CompilerOptions;
}

const findTsConfigFile = (dir: string) => {
  const file = findConfigFile(dir, sys.fileExists);
  if (!file) {
    throw new Error('could not find a valid tsconfig.json');
  }
  return file;
};

export function normalizeOptionsAndContext(
  options?: LibBuilderOptions,
  ctx?: LibBuilderContext,
): [Required<LibBuilderOptions>, Required<LibBuilderContext>] {
  options = options ?? {};
  ctx = ctx ?? {};
  ctx.cwd = ctx.cwd ?? process.cwd();
  ctx.projectRoot = ctx.projectRoot ?? getPackageRoot(ctx.cwd);
  ctx.packageInfo =
    ctx.packageInfo ?? json5.parse(fs.readFileSync(path.resolve(ctx.projectRoot!, 'package.json')).toString())!;
  options.formats = options.formats ?? ctx.packageInfo?.libbuilder?.formats ?? ['cjs', 'esm'];
  options.entry = options.entry ?? ctx.packageInfo.libbuilder?.entry ?? 'src/index.ts';
  options.esbuild = { ...ctx.packageInfo?.libbuilder?.esbuild, ...options.esbuild };
  options.esbuild.tsconfig =
    options.esbuild.tsconfig ?? ctx.packageInfo?.libbuilder?.esbuild?.tsconfig ?? findTsConfigFile(ctx.cwd);
  ctx.tsCompilerOptions = ctx.tsCompilerOptions ?? {
    ...getDefaultCompilerOptions(),
    ...getCompilerOptionsFromConfigFilePath(options.esbuild.tsconfig),
  };
  options.esbuild.absWorkingDir = options.esbuild.absWorkingDir ?? ctx.projectRoot;
  options.esbuild.outdir = options.esbuild.outdir ?? getOutputFromContext(ctx);
  options.esbuild.external =
    options.esbuild.external ??
    Object.keys({ ...ctx.packageInfo.dependencies, ...ctx.packageInfo.devDependencies }).reduce<Array<string>>(
      (result, dep) => result.concat(`${dep}/*`, dep),
      [],
    );
  options.esbuild.sourcemap = options.esbuild.sourcemap ?? !!ctx.tsCompilerOptions.sourceMap;
  return [options, ctx] as [Required<LibBuilderOptions>, Required<LibBuilderContext>];
}

export function getOutputFromContext(ctx: LibBuilderContext) {
  if (!ctx.tsCompilerOptions?.outDir) {
    throw new Error('could not determine the output directory, you should set outDir in tsconfig.json.');
  }
  if (!ctx.projectRoot) {
    throw new Error('could not determine the output directory, cause project root not found.');
  }
  return path.resolve(ctx.projectRoot, ctx.tsCompilerOptions.outDir);
}

const context = '[libbuilder]';

export const logger = {
  success(...args: any[]): void {
    console.log(colors.green(`${context}: ${args.join(' ')}`));
  },
  log(...args: any[]): void {
    console.log(`${context}: ${args.join(' ')}`);
  },
  info(...args: any[]): void {
    console.info(colors.cyan(`${context}: ${args.join(' ')}`));
  },
  warn(...args: any[]): void {
    console.warn(colors.yellow(`${context}: ${args.join(' ')}`));
  },
  error(...args: any[]): void {
    console.error(colors.red(`${context}: ${args.join(' ')}`));
  },
};

export class CustomizePromise<T = void> {
  promise: Promise<T>;
  resolve: (result: T) => void = () => {};
  reject: (reason?: any) => void = () => {};
  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

function getPackageRoot(startPath: string): string {
  const dirs = startPath.split(path.sep);
  while (dirs.length) {
    const dir = dirs.join(path.sep);
    const filepath = path.resolve(dir, 'package.json');
    if (fs.existsSync(filepath)) {
      return dir;
    }
    dirs.pop();
  }
  throw new Error('could not detect project root.');
}

function getCompilerOptionsFromConfigFilePath(filepath?: string): CompilerOptions {
  if (!filepath) {
    return {};
  }
  const tsConfig = json5.parse(fs.readFileSync(filepath).toString());
  if (!tsConfig.extends) {
    return tsConfig.compilerOptions;
  }
  const parentPath = path.resolve(path.dirname(filepath), tsConfig.extends);
  return {
    ...getCompilerOptionsFromConfigFilePath(parentPath),
    ...tsConfig.compilerOptions,
  };
}
