import path from 'path';
import esbuild from 'esbuild';
import { LibBuilderOptions, LibBuilderContext, normalizeOptionsAndContext, logger } from './utils';
import { dts } from './dts';

export async function build(_options?: LibBuilderOptions, _ctx?: LibBuilderContext) {
  const [options, ctx] = normalizeOptionsAndContext(_options, _ctx);
  logger.info(`${ctx.packageInfo.name} --> Start to build project.`);
  await Promise.all(
    options.formats.map((format) => {
      return esbuild.build({
        bundle: true,
        write: true,
        format,
        entryPoints: [options.entry],
        ...options.esbuild,
        outdir: path.resolve(options.esbuild.outdir!, options.formats.length === 1 ? '' : format),
      });
    }),
  );
  if (ctx.tsCompilerOptions.declaration) {
    await dts(options, ctx);
  }
  logger.success(`${ctx.packageInfo.name} --> Build project completed.`);
}
