#!/usr/bin/env node
// Installer: asks before installing the kit into each harness found on PATH
// (Claude Code, Codex, OpenCode). Never installs silently. Zero dependencies, Node >= 22.
import { accessSync, constants, existsSync, realpathSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { delimiter, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const HARNESSES = ['claude', 'codex', 'opencode'];
const UPSTREAM = 'superpowers';
const NEXT_STEP = 'Next: in a project repo, ask your agent to run the screen-spec-setup skill.';

export function detectHarnesses(pathEnv) {
  const dirs = String(pathEnv ?? '').split(delimiter).filter(Boolean);
  const isExec = (p) => {
    try {
      if (!statSync(p).isFile()) return false;
      accessSync(p, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };
  return Object.fromEntries(HARNESSES.map((h) => [h, dirs.some((d) => isExec(join(d, h)))]));
}

export function defaultConfigHome(env = process.env) {
  return env.XDG_CONFIG_HOME || join(env.HOME || homedir(), '.config');
}

export function planInstall(found, { repoUrl, name, configHome = defaultConfigHome(), scope = 'user', only = null, cwd = process.cwd() }) {
  const project = scope === 'project';
  const want = (h) => found[h] && (!only || only.includes(h));
  const plan = [];
  if (want('claude')) {
    // `--marketplace <source>` adds the marketplace first when it is not configured yet.
    const command = ['claude', 'plugin', 'install', name, '--marketplace', repoUrl];
    if (project) plan.push({ harness: 'claude', command: [...command, '--scope', 'project'], cwd });
    else plan.push({ harness: 'claude', command });
  }
  if (want('codex')) {
    if (project) {
      plan.push({
        harness: 'codex',
        command: null,
        skipped: 'Codex has no project scope; skipped (use --scope user to install globally)',
      });
    } else {
      // The marketplace and the plugin both carry the distribution name.
      plan.push({ harness: 'codex', command: ['codex', 'plugin', 'marketplace', 'add', repoUrl] });
      plan.push({ harness: 'codex', command: ['codex', 'plugin', 'add', `${name}@${name}`] });
    }
  }
  if (want('opencode')) {
    plan.push({
      harness: 'opencode',
      command: null,
      configEdit: {
        file: project ? join(cwd, 'opencode.json') : join(configHome, 'opencode', 'opencode.json'),
        key: 'plugin',
        value: `${name}@git+${repoUrl.replace(/\.git$/, '')}.git`,
      },
    });
  }
  return plan;
}

const realRun = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });

// Read-only: lists installed plugins via the harness list commands / reads the OpenCode config.
export function detectUpstreamSuperpowers(found, { run = realRun, opencodeConfigFile } = {}) {
  const hits = [];
  const tryList = (cmd, pick) => {
    try {
      return pick(JSON.parse(run(cmd, ['plugin', 'list', '--json'])));
    } catch {
      return false;
    }
  };
  if (found.claude && tryList('claude', (j) => j.some((p) => String(p.id).split('@')[0] === UPSTREAM))) hits.push('claude');
  if (found.codex && tryList('codex', (j) => (j.installed ?? []).some((p) => p.name === UPSTREAM))) hits.push('codex');
  if (found.opencode) {
    try {
      const file = opencodeConfigFile ?? join(defaultConfigHome(), 'opencode', 'opencode.json');
      const cfg = JSON.parse(readFileSync(file, 'utf8'));
      const entries = [...(cfg.plugin ?? []), ...(cfg.plugins ?? [])];
      if (entries.some((e) => /^superpowers@git\+.*obra\/superpowers/.test(String(e)))) hits.push('opencode');
    } catch {
      /* missing or not plain JSON: nothing to report */
    }
  }
  return hits;
}

export function upstreamUninstallHint(harness) {
  return {
    claude: 'claude plugin uninstall superpowers',
    codex: 'codex plugin remove superpowers',
    opencode: 'remove the "superpowers@git+https://github.com/obra/superpowers.git" entry from your opencode config plugin list',
  }[harness];
}

// Adds `value` to config[key] (array) without touching anything else.
// Returns { status: 'added' | 'exists' | 'skipped', snippet? }.
export function mergeOpencodePlugin(file, key, value) {
  const snippet = JSON.stringify({ [key]: [value] }, null, 2);
  let cfg = {};
  if (existsSync(file)) {
    try {
      cfg = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return { status: 'skipped', snippet }; // JSONC or malformed: do not rewrite
    }
    if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) return { status: 'skipped', snippet };
  }
  if (cfg[key] === undefined) cfg[key] = [];
  if (!Array.isArray(cfg[key])) return { status: 'skipped', snippet };
  if (cfg[key].includes(value)) return { status: 'exists' };
  cfg[key].push(value);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return { status: 'added' };
}

const USAGE = 'Usage: install.mjs [--yes] [--only claude,codex,opencode] [--scope user|project] [--dry-run] [--repo <git url>]';

export function parseArgs(argv, defaultRepo) {
  const opts = { dryRun: false, repo: defaultRepo, only: null, scope: 'user', yes: false };
  const value = (i, flag, what) => {
    const v = argv[i];
    if (!v || v.startsWith('--')) throw new Error(`${flag} needs ${what}`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--repo') opts.repo = value(++i, '--repo', 'a git URL');
    else if (a === '--scope') {
      opts.scope = value(++i, '--scope', 'user or project');
      if (!['user', 'project'].includes(opts.scope)) throw new Error(`--scope must be user or project, got: ${opts.scope}`);
    } else if (a === '--only') {
      opts.only = value(++i, '--only', 'a comma-separated list of harnesses').split(',').map((x) => x.trim()).filter(Boolean);
      const bad = opts.only.filter((h) => !HARNESSES.includes(h));
      if (bad.length || opts.only.length === 0) throw new Error(`unknown harness in --only: ${bad.join(', ') || '(empty)'} (choose from ${HARNESSES.join(', ')})`);
    } else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

async function readlinePrompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

const realExec = (cmd, args, { cwd } = {}) => spawnSync(cmd, args, { stdio: 'inherit', cwd }).status;

export async function main(argv, env = process.env, deps = {}) {
  const log = deps.log ?? ((m) => console.log(m));
  const error = deps.error ?? ((m) => console.error(m));
  const cwd = deps.cwd ?? process.cwd();
  const exec = deps.exec ?? realExec;
  const prompt = deps.prompt ?? readlinePrompt;
  const interactive = deps.isTTY ?? Boolean(process.stdin.isTTY);
  const config = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'kit.config.json'), 'utf8'));
  let opts;
  try {
    opts = parseArgs(argv, config.distRepo);
  } catch (e) {
    error(`${e.message}\n${USAGE}`);
    return 2;
  }
  const found = detectHarnesses(env.PATH);
  const configHome = defaultConfigHome(env);
  const plan = planInstall(found, { repoUrl: opts.repo, name: config.name, configHome, scope: opts.scope, only: opts.only, cwd });
  const targets = HARNESSES.filter((h) => plan.some((s) => s.harness === h));
  if (targets.length === 0) {
    error(`No supported harness found on PATH${opts.only ? ` among --only ${opts.only.join(',')}` : ''} (looked for: ${(opts.only ?? HARNESSES).join(', ')}).`);
    return 1;
  }
  const upstream = detectUpstreamSuperpowers(found, {
    run: deps.listRun ?? realRun,
    opencodeConfigFile: join(configHome, 'opencode', 'opencode.json'),
  });

  // Up-front notice.
  log(`Screen-spec agent kit "${config.name}" (scope: ${opts.scope}) would be installed into:`);
  for (const h of targets) {
    const steps = plan.filter((s) => s.harness === h);
    log(`  ${h}:`);
    for (const s of steps) {
      if (s.skipped) log(`    skip: ${s.skipped}`);
      else if (s.command) log(`    $ ${s.command.join(' ')}${s.cwd ? `   (in ${s.cwd})` : ''}`);
      else log(`    add "${s.configEdit.value}" to "${s.configEdit.key}" in ${s.configEdit.file}`);
    }
    if (upstream.includes(h)) {
      log(`    upstream superpowers is installed in ${h}. Uninstall it yourself with: ${upstreamUninstallHint(h)}`);
    }
  }
  log('This kit REPLACES upstream superpowers: it ships skills with the same names, so running both duplicates them.');
  log('Nothing is uninstalled automatically.');
  if (opts.scope === 'project' && !existsSync(join(cwd, '.git'))) {
    log(`warning: ${cwd} is not a git repository root (no .git). Project scope will install here.`);
  }

  if (opts.dryRun) {
    log('\n(dry run: nothing was installed)');
    log(`\n${NEXT_STEP}`);
    return 0;
  }
  if (!opts.yes && !interactive) {
    error('\nNot a terminal and --yes not given: installing nothing.\nre-run with --yes to install non-interactively.');
    return 1;
  }

  let failed = false;
  let installedAny = false;
  for (const harness of targets) {
    const steps = plan.filter((s) => s.harness === harness);
    if (steps.every((s) => s.skipped)) {
      log(`== ${harness}: ${steps[0].skipped}`);
      continue;
    }
    if (!opts.yes) {
      const ans = String(await prompt(`Install into ${harness} (${opts.scope})? [y/N] `)).trim().toLowerCase();
      if (ans !== 'y' && ans !== 'yes') {
        log(`== ${harness}: skipped`);
        continue;
      }
    }
    log(`== ${harness}`);
    for (const step of steps) {
      if (step.command) {
        log(`$ ${step.command.join(' ')}`);
        const status = exec(step.command[0], step.command.slice(1), { cwd: step.cwd });
        if (status !== 0) {
          failed = true;
          error(`${harness}: command failed (exit ${status ?? 'signal'}); skipping the rest of this harness.`);
          break;
        }
        installedAny = true;
      } else {
        const { file, key, value } = step.configEdit;
        log(`add "${value}" to "${key}" in ${file}`);
        const r = mergeOpencodePlugin(file, key, value);
        if (r.status === 'added') {
          log('done');
          installedAny = true;
        } else if (r.status === 'exists') log('already present');
        else log(`could not edit ${file} safely (not plain JSON). Add this yourself:\n${r.snippet}`);
      }
    }
  }
  if (installedAny || !failed) log(`\n${NEXT_STEP}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = await main(process.argv.slice(2));
}
