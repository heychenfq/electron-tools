import path from 'path';
import fs from 'fs';
import {
  normalizeOptionsAndContext,
  getOutputFromContext,
  LibBuilderContext,
  LibBuilderOptions,
  logger,
} from './utils';

export function clean(options?: LibBuilderOptions, ctx?: LibBuilderContext) {
  const [, finalCtx] = normalizeOptionsAndContext(options, ctx);
  const outputDir = getOutputFromContext(finalCtx);
  logger.info(`delete out directory: ${outputDir}`);
  if (fs.existsSync(outputDir)) {
    fs.rmdirSync(outputDir, { recursive: true });
  }
  const temporaryDir = path.resolve(finalCtx.projectRoot, '.libbuilder');
  logger.info(`delete temporary directory: ${temporaryDir}`);
  if (fs.existsSync(temporaryDir)) {
    fs.rmdirSync(temporaryDir, { recursive: true });
  }
}
