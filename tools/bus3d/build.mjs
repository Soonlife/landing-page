// 순버스 카드의 3D 버스 번들을 만든다. three.js는 앱 저장소(기본 ../app)의 node_modules를 그대로 쓴다.
//   node tools/bus3d/build.mjs            (APP_DIR=/path/to/app 로 위치를 바꿀 수 있음)
// 결과: resources/build/bus3d.js — 커밋한다 (배포는 빌드 없이 정적 파일만)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const appDir = path.resolve(process.env.APP_DIR ?? path.join(root, '../app'));
const require = createRequire(path.join(appDir, 'package.json'));
const esbuild = require('esbuild');

await esbuild.build({
    entryPoints: { bus3d: path.join(here, 'entry.ts') },
    outdir: path.join(root, 'resources/build'),
    bundle: true,
    format: 'esm',
    target: 'es2020',
    minify: true,
    legalComments: 'eof',
    nodePaths: [path.join(appDir, 'node_modules')],
    logLevel: 'info',
});
