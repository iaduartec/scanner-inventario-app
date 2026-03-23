import { rm, mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const COPY_TARGETS = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'css',
  'icons',
  'js',
];

async function copyRecursive(source, destination) {
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await mkdir(destination, { recursive: true });
    const entries = await readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      const nextSource = path.join(source, entry.name);
      const nextDestination = path.join(destination, entry.name);
      if (entry.isDirectory()) {
        await copyRecursive(nextSource, nextDestination);
      } else if (entry.isFile()) {
        await copyFile(nextSource, nextDestination);
      }
    }
    return;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const target of COPY_TARGETS) {
    const source = path.join(ROOT, target);
    const destination = path.join(DIST, target);
    await copyRecursive(source, destination);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
