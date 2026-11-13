#!/usr/bin/env node
// One-command installer: installs the kit into every harness found on PATH
// (Claude Code, Codex, OpenCode). Zero dependencies, Node >= 22.
import { accessSync, constants, existsSync, realpathSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { delimiter, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

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

export function planInstall(found, { repoUrl, name, configHome = defaultConfigHome() }) {
  const plan = [];
  if (found.claude) {
    // `--marketplace <source>` adds the marketplace first when it is not configured yet.
    plan.push({ harness: 'claude', command: ['claude', 'plugin', 'install', name, '--marketplace', repoUrl] });
  }
  if (found.codex) {
    // The marketplace and the plugin both carry the distribution name.
    plan.push({ harness: 'codex', command: ['codex', 'plugin', 'marketplace', 'add', repoUrl] });
    plan.push({ harness: 'codex', command: ['codex', 'plugin', 'add', `${name}@${name}`] });
  }
  if (found.opencode) {
    plan.push({
      harness: 'opencode',
      command: null,
      configEdit: {
        file: join(configHome, 'opencode', 'opencode.json'),
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

function parseArgs(argv, defaultRepo) {
  const opts = { dryRun: false, repo: defaultRepo };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--repo') {
      opts.repo = argv[++i];
      if (!opts.repo) throw new Error('--repo needs a git URL');
    } else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return opts;
}

export function main(argv, env = process.env) {
  const config = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'kit.config.json'), 'utf8'));
  let opts;
  try {
    opts = parseArgs(argv, config.distRepo);
  } catch (e) {
    console.error(`${e.message}\nUsage: install.mjs [--dry-run] [--repo <git url>]`);
    return 2;
  }
  const found = detectHarnesses(env.PATH);
  const plan = planInstall(found, { repoUrl: opts.repo, name: config.name, configHome: defaultConfigHome(env) });
  if (plan.length === 0) {
    console.error('No supported harness found on PATH (looked for: claude, codex, opencode).');
    return 1;
  }
  const upstream = detectUpstreamSuperpowers(found, {
    opencodeConfigFile: join(defaultConfigHome(env), 'opencode', 'opencode.json'),
  });
  let failed = false;
  for (const harness of HARNESSES.filter((h) => found[h])) {
    console.log(`== ${harness}${opts.dryRun ? ' (dry run)' : ''}`);
    for (const step of plan.filter((s) => s.harness === harness)) {
      if (step.command) {
        console.log(`$ ${step.command.join(' ')}`);
        if (!opts.dryRun) {
          const r = spawnSync(step.command[0], step.command.slice(1), { stdio: 'inherit' });
          if (r.status !== 0) {
            failed = true;
            console.error(`${harness}: command failed (exit ${r.status ?? 'signal'}); skipping the rest of this harness.`);
            break;
          }
        }
      } else {
        const { file, key, value } = step.configEdit;
        console.log(`add "${value}" to "${key}" in ${file}`);
        if (!opts.dryRun) {
          const r = mergeOpencodePlugin(file, key, value);
          if (r.status === 'added') console.log('done');
          else if (r.status === 'exists') console.log('already present');
          else console.log(`could not edit ${file} safely (not plain JSON). Add this yourself:\n${r.snippet}`);
        }
      }
    }
    if (upstream.includes(harness)) {
      console.log(
        `warning: upstream superpowers is also installed in ${harness}; both will register the same skills. ` +
          `Uninstall it with: ${upstreamUninstallHint(harness)}`,
      );
    }
  }
  console.log(`\n${NEXT_STEP}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
