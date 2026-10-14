import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const ASSET_BRANCH = process.env.ASSET_BRANCH || 'Assets';
const LIBRARY_DIR = 'library';
const CANDIDATES = [
  { file: 'earth-relief-bump.jpg', purpose: 'Unreferenced alternate Earth relief/bump texture; retained for future art direction.' },
  { file: 'earth-relief-skin.jpg', purpose: 'Earth surface texture reference; not loaded by current runtime code.' },
  { file: 'moon-phase-01-new-moon.svg', purpose: 'Moon phase reference artwork; not loaded by current runtime code.' },
  { file: 'moon-phase-02-waxing-crescent.svg', purpose: 'Moon phase reference artwork; not loaded by current runtime code.' },
  { file: 'moon-phase-03-first-quarter.svg', purpose: 'Moon phase reference artwork; not loaded by current runtime code.' },
  { file: 'moon-phase-04-waxing-gibbous.svg', purpose: 'Moon phase reference artwork; not loaded by current runtime code.' },
  { file: 'moon-phase-05-full-moon.svg', purpose: 'Moon phase reference artwork; not loaded by current runtime code.' },
  { file: 'moon-phase-06-waning-gibbous.svg', purpose: 'Moon phase reference artwork; not loaded by current runtime code.' },
  { file: 'moon-phase-07-last-quarter.svg', purpose: 'Moon phase reference artwork; not loaded by current runtime code.' },
  { file: 'moon-phase-08-waning-crescent.svg', purpose: 'Moon phase reference artwork; not loaded by current runtime code.' },
  { file: 'moon-texture.svg', purpose: 'Moon texture reference artwork; not loaded by current runtime code.' },
  { file: 'sun-object.svg', purpose: 'Alternate Sun object artwork; not loaded by current runtime code.' },
  { file: 'celestial-vector-manifest.json', purpose: 'Reference manifest for the archived celestial vector assets.' },
];

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: options.cwd || ROOT, encoding: 'utf8', stdio: options.stdio || ['ignore', 'pipe', 'pipe'] }).trim();
}
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function isRuntimeSource(file) { return /\.(html|css|js|webmanifest)$/i.test(file) && !file.startsWith('.github/') && !file.startsWith('scripts/'); }
function findRuntimeReferences(filename) {
  const hits = [];
  const visit = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'dist') continue;
      const abs = path.join(dir, ent.name);
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      if (ent.isDirectory()) visit(abs);
      else if (isRuntimeSource(rel)) {
        const body = fs.readFileSync(abs, 'utf8');
        if (body.includes(filename)) hits.push(rel);
      }
    }
  };
  visit(ROOT);
  return hits;
}
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }

const present = CANDIDATES.filter(x => exists(x.file));
if (!present.length) {
  console.log('Asset organizer: no allowlisted non-runtime assets found on main; nothing to move.');
  process.exit(0);
}

// Fail closed: never move an allowlisted file if runtime source refers to it.
const unsafe = [];
for (const item of present) {
  const refs = findRuntimeReferences(item.file);
  if (refs.length) unsafe.push({ file: item.file, refs });
}
if (unsafe.length) {
  console.error('Asset organizer stopped safely. Runtime references were found:');
  for (const item of unsafe) console.error(`- ${item.file}: ${item.refs.join(', ')}`);
  process.exit(1);
}

const payloadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-live-assets-'));
for (const item of present) {
  fs.copyFileSync(path.join(ROOT, item.file), path.join(payloadRoot, item.file));
}

const worktree = path.join(os.tmpdir(), `earth-live-assets-worktree-${process.pid}`);
const bootstrapBranch = `assets-bootstrap-${process.pid}`;
let createdBootstrapBranch = false;
const remoteExists = Boolean(git(['ls-remote', '--heads', 'origin', `refs/heads/${ASSET_BRANCH}`]));
let worktreeAdded = false;
try {
  if (remoteExists) {
    git(['fetch', 'origin', `refs/heads/${ASSET_BRANCH}:refs/remotes/origin/${ASSET_BRANCH}`]);
    git(['worktree', 'add', '--detach', worktree, `refs/remotes/origin/${ASSET_BRANCH}`]);
  } else {
    git(['worktree', 'add', '--detach', worktree, 'HEAD']);
    git(['checkout', '--orphan', bootstrapBranch], { cwd: worktree });
    createdBootstrapBranch = true;
    // This is a separate temporary worktree. Only its new Assets branch is cleared.
    git(['rm', '-rf', '--ignore-unmatch', '.'], { cwd: worktree });
  }
  worktreeAdded = true;

  const library = path.join(worktree, LIBRARY_DIR);
  fs.mkdirSync(library, { recursive: true });
  for (const item of present) fs.copyFileSync(path.join(payloadRoot, item.file), path.join(library, item.file));

  const readmePath = path.join(library, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath,
      '# EARTH // LIVE asset library\n\n' +
      'Non-runtime artwork and reference assets archived by the automated organizer.\n' +
      'Files are retained here for reuse; this branch is not served as the live app.\n' +
      'Runtime-required files must remain on `main` unless their URLs and deployment are deliberately migrated.\n');
  }

  // Rebuild a stable catalog from every file in the library except the catalog itself.
  const catalogItems = [];
  for (const name of fs.readdirSync(library).sort()) {
    const abs = path.join(library, name);
    if (!fs.statSync(abs).isFile() || name === 'ASSET-CATALOG.json' || name === 'README.md') continue;
    const known = CANDIDATES.find(x => x.file === name);
    catalogItems.push({
      file: name,
      original_path: name,
      purpose: known?.purpose || 'Previously archived asset retained for reuse.',
      bytes: fs.statSync(abs).size,
      sha256: sha256(abs),
    });
  }
  writeJson(path.join(library, 'ASSET-CATALOG.json'), {
    project: 'EARTH // LIVE',
    branch: ASSET_BRANCH,
    policy: 'Non-runtime assets only. Never delete archived assets automatically.',
    assets: catalogItems,
  });

  git(['add', '-A', LIBRARY_DIR], { cwd: worktree });
  const hasChanges = (() => {
    try { git(['diff', '--cached', '--quiet'], { cwd: worktree }); return false; }
    catch { return true; }
  })();
  if (hasChanges) {
    git(['config', 'user.name', 'github-actions[bot]'], { cwd: worktree });
    git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { cwd: worktree });
    git(['commit', '-m', 'chore(assets): archive approved non-runtime assets'], { cwd: worktree });
    git(['push', 'origin', `HEAD:refs/heads/${ASSET_BRANCH}`], { cwd: worktree });
    console.log(`Asset organizer: safely published ${present.length} file(s) to branch ${ASSET_BRANCH}.`);
  } else {
    console.log(`Asset organizer: branch ${ASSET_BRANCH} already contains these asset versions.`);
  }

  // Only after the asset branch is confirmed updated, remove the same allowlisted files from main.
  git(['rm', '--', ...present.map(x => x.file)]);
  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['commit', '-m', 'chore(assets): remove archived non-runtime assets from main']);
  git(['push', 'origin', 'HEAD:refs/heads/main']);
  console.log(`Asset organizer: removed ${present.length} archived file(s) from main after branch verification.`);
} finally {
  if (worktreeAdded) {
    try { git(['worktree', 'remove', '--force', worktree]); } catch {}
  }
  if (createdBootstrapBranch) {
    try { git(['branch', '-D', bootstrapBranch]); } catch {}
  }
  fs.rmSync(payloadRoot, { recursive: true, force: true });
}
