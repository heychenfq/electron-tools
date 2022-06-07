import path from 'path';
import fs from 'fs';
import { normalizeOptionsAndContext, getOutputFromContext, EsLibcContext, EsLibcOptions, logger } from './utils';

export function clean(options?: EsLibcOptions, ctx?: EsLibcContext) {
  const [, finalCtx] = normalizeOptionsAndContext(options, ctx);
  const outputDir = getOutputFromContext(finalCtx);
  logger.info(`delete out directory: ${outputDir}`);
  if (fs.existsSync(outputDir)) {
    fs.rmdirSync(outputDir, { recursive: true });
  }
  const temporaryDir = path.resolve(finalCtx.projectRoot, '.eslibc');
  logger.info(`delete temporary directory: ${temporaryDir}`);
  if (fs.existsSync(temporaryDir)) {
    fs.rmdirSync(temporaryDir, { recursive: true });
  }
}
