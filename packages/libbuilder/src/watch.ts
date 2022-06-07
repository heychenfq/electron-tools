import path from 'path';
import esbuild from 'esbuild';
import {
  getOutputFromContext,
  LibBuilderContext,
  LibBuilderOptions,
  logger,
  normalizeOptionsAndContext,
} from './utils';
import { dts } from './dts';

export async function watch(_options?: LibBuilderOptions, _ctx?: LibBuilderContext) {
  const [options, ctx] = normalizeOptionsAndContext(_options, _ctx);
  logger.info(`${ctx.packageInfo.name} --> Start to build project in watching mode.`);
  const results = await Promise.all(
    options.formats.map((format, index) => {
      const isLatest = index === options.formats.length - 1;
      return esbuild
        .build({
          absWorkingDir: ctx.projectRoot,
          bundle: true,
          write: true,
          format,
          outdir: path.resolve(getOutputFromContext(ctx), format),
          sourcemap: !!ctx.tsCompilerOptions.sourceMap,
          watch: {
            onRebuild(error, result) {
              if (error) {
                logger.error(`${ctx.packageInfo.name} --> Rebuild with error: ${error}`);
              } else {
                logger.success(
                  `${ctx.packageInfo.name} --> Rebuild(${format}) project completed with ${
                    result!.errors.length
                  } errors, ${result!.warnings.length} warnings.`,
                );
                if (ctx.tsCompilerOptions.declaration && isLatest) {
                  dts(options, ctx);
                }
              }
            },
          },
        })
        .then((result) => {
          return {
            format,
            result,
          };
        });
    }),
  );
  if (ctx.tsCompilerOptions.declaration) {
    await dts(options, ctx);
  }
  results.forEach((result) => {
    logger.success(
      `${ctx.packageInfo.name} --> Build(${result.format}) project completed with ${result.result.errors.length} errors, ${result.result.warnings.length} warnings.`,
    );
  });
}
