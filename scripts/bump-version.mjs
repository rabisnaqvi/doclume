#!/usr/bin/env node
/**
 * Bump monorepo version: single semver written to root + each packages subfolder package.json.
 * Uses max(current versions) as base, then applies patch | minor | major, or sets exact semver.
 * When any manifest version changes, CHANGELOG.md is updated: body under ## [Unreleased] is moved
 * into a new ## [x.y.z] - YYYY-MM-DD section (local date), and [Unreleased] is left empty.
 *
 * Usage:
 *   node scripts/bump-version.mjs patch|minor|major
 *   node scripts/bump-version.mjs 1.2.3
 *   node scripts/bump-version.mjs patch --dry-run
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

/** @typedef {{ major: number; minor: number; patch: number; prerelease?: string; build?: string }} SemVer */

/** @param {string} v */
function parseSemver(v) {
  const m = v.trim().match(SEMVER_RE);
  if (!m) throw new Error(`Invalid semver: "${v}"`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4],
    build: m[5],
  };
}

/** @param {SemVer} a @param {SemVer} b */
function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  const pa = a.prerelease ?? '';
  const pb = b.prerelease ?? '';
  if (pa === pb) return 0;
  if (!pa && pb) return 1;
  if (pa && !pb) return -1;
  return pa < pb ? -1 : pa > pb ? 1 : 0;
}

/** @param {SemVer} s */
function formatSemver(s) {
  let out = `${s.major}.${s.minor}.${s.patch}`;
  if (s.prerelease) out += `-${s.prerelease}`;
  if (s.build) out += `+${s.build}`;
  return out;
}

/** @param {SemVer} current @param {'patch'|'minor'|'major'} kind */
function bump(current, kind) {
  const next = { ...current, prerelease: undefined, build: undefined };
  if (kind === 'major') {
    next.major += 1;
    next.minor = 0;
    next.patch = 0;
  } else if (kind === 'minor') {
    next.minor += 1;
    next.patch = 0;
  } else {
    next.patch += 1;
  }
  return next;
}

const MANIFESTS = [
  resolve(root, 'package.json'),
  resolve(root, 'packages/core/package.json'),
  resolve(root, 'packages/web/package.json'),
  resolve(root, 'packages/vscode/package.json'),
];

const CHANGELOG = resolve(root, 'CHANGELOG.md');

/** @param {Date} d */
function formatReleaseDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Split CHANGELOG around ## [Unreleased]: pre (inclusive of intro), body, post (from next ## […] onward).
 * @param {string} full
 */
function parseChangelogUnreleased(full) {
  const marker = '## [Unreleased]';
  const i = full.indexOf(marker);
  if (i === -1) throw new Error('CHANGELOG.md: missing "## [Unreleased]" heading');
  const pre = full.slice(0, i);
  const afterMarker = i + marker.length;
  const tail = full.slice(afterMarker);
  const leadingNl = tail.match(/^\r?\n/)?.[0]?.length ?? 0;
  const bodyStart = afterMarker + leadingNl;
  const searchFrom = full.slice(bodyStart);
  const nextMatch = /\r?\n## \[[^\]]+\]/.exec(searchFrom);
  if (!nextMatch) {
    return { pre, body: searchFrom.replace(/\s+$/, ''), post: '' };
  }
  const body = full.slice(bodyStart, bodyStart + nextMatch.index).replace(/\s+$/, '');
  const post = full.slice(bodyStart + nextMatch.index);
  return { pre, body, post };
}

/**
 * Move [Unreleased] notes into ## [version] - date; leave empty [Unreleased].
 * @param {string} full
 * @param {string} version
 * @param {string} date YYYY-MM-DD
 */
function applyChangelogRelease(full, version, date) {
  const { pre, body, post } = parseChangelogUnreleased(full);
  const bodyTrim = body.trim();
  const releaseBlock =
    bodyTrim === ''
      ? `## [${version}] - ${date}\n`
      : `## [${version}] - ${date}\n\n${bodyTrim}\n`;
  return `${pre}## [Unreleased]\n\n${releaseBlock}\n${post.replace(/^\r?\n/, '')}`;
}

function usage() {
  console.error(`Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z> [--dry-run]`);
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');
if (args.length !== 1) usage();

const arg = args[0];
const isBump = arg === 'patch' || arg === 'minor' || arg === 'major';

/** @param {string} path */
function readVersion(path) {
  const raw = readFileSync(path, 'utf-8');
  const pkg = JSON.parse(raw);
  if (typeof pkg.version !== 'string') throw new Error(`${path}: missing "version"`);
  return { path, pkg, version: pkg.version };
}

const snapshots = MANIFESTS.map(readVersion);

/** @param {string} a @param {string} b */
function maxSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  return compareSemver(pa, pb) >= 0 ? a : b;
}

const currentStr = snapshots.reduce((acc, s) => maxSemver(acc, s.version), snapshots[0].version);
const current = parseSemver(currentStr);

let nextStr;
if (isBump) {
  nextStr = formatSemver(bump(current, arg));
} else {
  parseSemver(arg); // validate
  nextStr = arg.trim();
}

const divergent = snapshots.filter((s) => s.version !== currentStr);
if (divergent.length) {
  console.warn(`Versions were out of sync (max=${currentStr}):`);
  for (const s of divergent) {
    console.warn(`  ${relative(root, s.path)}: ${s.version}`);
  }
}

console.log(`${currentStr} → ${nextStr}${dryRun ? ' (dry-run)' : ''}`);

const wouldWriteManifests = snapshots.some((s) => s.version !== nextStr);
const releaseDate = formatReleaseDate(new Date());

/** @type {string | null} */
let changelogNext = null;
if (wouldWriteManifests) {
  const changelogRaw = readFileSync(CHANGELOG, 'utf-8');
  changelogNext = applyChangelogRelease(changelogRaw, nextStr, releaseDate);
}

for (const s of snapshots) {
  if (s.version === nextStr) {
    console.log(`  skip (already ${nextStr}): ${relative(root, s.path)}`);
    continue;
  }
  s.pkg.version = nextStr;
  const out = `${JSON.stringify(s.pkg, null, 2)}\n`;
  if (!dryRun) writeFileSync(s.path, out, 'utf-8');
  console.log(`  ${dryRun ? 'would write' : 'wrote'}: ${relative(root, s.path)}`);
}

if (wouldWriteManifests) {
  const relChangelog = relative(root, CHANGELOG);
  if (dryRun) {
    console.log(`  would update: ${relChangelog} (move [Unreleased] → [${nextStr}] - ${releaseDate})`);
  } else if (changelogNext !== null) {
    writeFileSync(CHANGELOG, changelogNext, 'utf-8');
    console.log(`  wrote: ${relChangelog}`);
  }
}

if (dryRun) console.log('Dry-run: no files modified.');
