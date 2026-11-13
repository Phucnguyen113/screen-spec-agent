#!/usr/bin/env node
// Builds the renamed Screen-spec Agent distribution from the pristine upstream copy.
import { cp, mkdir, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import { join, relative, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['.git', 'dist', 'node_modules', join('screen-spec', 'tests'), join('screen-spec', 'evals')]);
const REWRITE_DIRS = ['skills', 'hooks', '.opencode'];
const REWRITE_EXT = new Set(['.md', '.js', '.json', '']);
// Skill references: `superpowers:name`, and the bare prefix written as \`superpowers:\` in JS template strings.
const SKILL_PREFIX = /\bsuperpowers:(?=[a-z]|\\?`)/g;
const AUTHOR = { name: 'Screen-spec' };
const DESCRIPTION_SUFFIX = ' Powered by superpowers (github.com/obra/superpowers).';

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

export function creditDescription(text) {
  const credit = DESCRIPTION_SUFFIX.trim();
  if (text.endsWith(credit)) return text;
  const base = text.trimEnd();
  if (!base) return credit;
  return (/[.!?]$/.test(base) ? base : `${base}.`) + DESCRIPTION_SUFFIX;
}

// Owner/name of a GitHub distRepo URL, for `npx github:<owner>/<name>`.
function repoSlug(url) {
  const m = /^https:\/\/github\.com\/([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(url);
  if (!m) throw new Error(`distRepo must be https://github.com/<owner>/<name>, got ${url}`);
  return m[1];
}

// Refuses an outDir that would wipe or swallow the source, or that holds something other than
// a previous dist; clears a previous dist so stale files do not ship.
async function prepareOutDir(src, out, config) {
  if (out === src || src.startsWith(out + sep)) {
    throw new Error(`outDir ${out} must not be the source directory or one of its ancestors`);
  }
  const entries = await readdir(out).catch((e) => {
    if (e.code === 'ENOENT') return [];
    throw e;
  });
  if (entries.length === 0) return;
  const manifest = await readFile(join(out, '.claude-plugin', 'plugin.json'), 'utf8').then(JSON.parse, () => null);
  if (manifest?.name !== config.name) {
    throw new Error(`outDir ${out} is not empty and is not a previous ${config.name} dist; refusing to clear it`);
  }
  await rm(out, { recursive: true, force: true });
}

async function patchJson(file, patch) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  patch(data);
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

// allowPlaceholder: local builds (evals) may use the provisional `<org>` distRepo; releases may not.
export async function buildDist(srcDir, outDir, config, { allowPlaceholder = false } = {}) {
  const src = resolve(srcDir);
  const out = resolve(outDir);
  if (!allowPlaceholder && config.distRepo.includes('<')) {
    throw new Error(`distRepo in kit.config.json is still a placeholder (${config.distRepo}); set the real distribution repo before releasing`);
  }
  const slug = repoSlug(config.distRepo);
  await prepareOutDir(src, out, config);
  // Manual walk: outDir may live inside srcDir (default dist/), which fs.cp rejects.
  const outRel = relative(src, out);
  const copyTree = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = relative(src, p);
      if (SKIP.has(rel) || rel === outRel) continue;
      if (e.isDirectory()) {
        await mkdir(join(out, rel), { recursive: true });
        await copyTree(p);
      } else if (e.isFile()) {
        await cp(p, join(out, rel));
      }
    }
  };
  await mkdir(out, { recursive: true });
  await copyTree(src);

  // Credit-bearing README replaces the upstream one; the distribution repo comes from the config.
  const readme = await readFile(join(src, 'screen-spec', 'README.md'), 'utf8');
  await writeFile(
    join(out, 'README.md'),
    readme.replaceAll('{{distRepoSlug}}', slug).replaceAll('{{distRepo}}', config.distRepo),
  );

  // Rewrite skill prefix in text files.
  for (const d of REWRITE_DIRS) {
    const root = join(out, d);
    if (!(await stat(root).catch(() => null))) continue;
    for await (const f of walk(root)) {
      if (!REWRITE_EXT.has(extname(f))) continue;
      const text = await readFile(f, 'utf8');
      const next = text.replace(SKILL_PREFIX, `${config.name}:`);
      if (next !== text) await writeFile(f, next);
    }
  }

  const brand = (o) => {
    o.author = { ...AUTHOR };
    o.homepage = config.distRepo;
    o.repository = config.distRepo;
    appendCredit(o, 'description');
  };
  const appendCredit = (o, key) => {
    if (typeof o[key] === 'string') o[key] = creditDescription(o[key]);
  };
  const product = (text) => text.replace(/\bSuperpowers\b/g, config.displayName);
  const rename = (o) => {
    o.name = config.name;
    brand(o);
  };

  await patchJson(join(out, '.claude-plugin/plugin.json'), rename);
  await patchJson(join(out, '.codex-plugin/plugin.json'), (j) => {
    rename(j);
    const i = j.interface ?? (j.interface = {});
    i.displayName = config.displayName;
    i.developerName = AUTHOR.name;
    i.websiteURL = config.distRepo;
    if (i.shortDescription) i.shortDescription = product(i.shortDescription);
    if (i.longDescription) i.longDescription = product(i.longDescription);
    appendCredit(i, 'longDescription');
  });
  for (const m of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
    await patchJson(join(out, m), (j) => {
      j.name = config.name;
      if (m.startsWith('.claude-plugin')) j.owner = { ...AUTHOR };
      else (j.interface ??= {}).displayName = config.displayName;
      for (const p of j.plugins) {
        p.description ??= '';
        rename(p);
      }
    });
  }
  await patchJson(join(out, 'package.json'), (j) => {
    j.name = config.name;
    delete j.private;
    delete j.scripts;
    j.bin = { [config.name]: 'screen-spec/bin/install.mjs' };
    brand(j);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kitRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const config = JSON.parse(await readFile(join(kitRoot, 'screen-spec/kit.config.json'), 'utf8'));
  await buildDist(kitRoot, resolve(process.argv[2] ?? join(kitRoot, 'dist')), config);
}
