#!/usr/bin/env node
/**
 * Generates a copy-paste-ready PR title + description for the FE and BE repos,
 * covering EVERYTHING on the current branch vs the base branch (all commits and
 * the full diff), not just the latest session.
 *
 * Print-only: never commits, pushes, or opens a PR.
 *
 * Usage (from anywhere):
 *   node frontend/scripts/pr-description.mjs                 # both repos
 *   node frontend/scripts/pr-description.mjs --only=be       # backend only
 *   node frontend/scripts/pr-description.mjs --only=fe --part=body --copy
 *
 * Flags:
 *   --base=main        base branch to compare against (default: main)
 *   --only=fe|be       just one repo
 *   --part=title|body  print only that part (default: both)
 *   --copy             pipe the output to the clipboard (macOS pbcopy)
 *   --title="..."      override the generated title
 *
 * Assumes ../backend and ../frontend are siblings under the same parent.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REPOS = {
  be: { label: 'BACKEND', dir: path.join(ROOT, 'backend') },
  fe: { label: 'FRONTEND', dir: path.join(ROOT, 'frontend') },
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)
const BASE = args.base || 'main'

const git = (dir, ...a) =>
  execFileSync('git', a, { cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim()

function baseRef(dir) {
  for (const ref of [BASE, `origin/${BASE}`]) {
    try {
      git(dir, 'rev-parse', '--verify', '--quiet', ref)
      return ref
    } catch {}
  }
  throw new Error(`Base branch "${BASE}" not found in ${dir}`)
}

// ---------- collect ----------
function collect(dir) {
  const base = baseRef(dir)
  const branch = git(dir, 'branch', '--show-current')
  const raw = git(dir, 'log', `${base}..HEAD`, '--reverse', '--format=%H%x1f%s%x1f%b%x1e')
  const commits = raw
    .split('\x1e')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [, subject, body = ''] = c.split('\x1f')
      const m = subject.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/)
      return { subject, body: body.trim(), type: m?.[1], scope: m?.[2], text: m?.[3] ?? subject }
    })

  const files = git(dir, 'diff', '--name-status', '-M', `${base}...HEAD`)
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const p = l.split('\t')
      return { status: p[0][0], file: p[p.length - 1] }
    })

  const numstat = git(dir, 'diff', '--numstat', `${base}...HEAD`)
    .split('\n')
    .filter(Boolean)
    .reduce(
      (acc, l) => {
        const [a, d] = l.split('\t')
        acc.add += Number(a) || 0
        acc.del += Number(d) || 0
        return acc
      },
      { add: 0, del: 0 }
    )

  const uncommitted = git(dir, 'status', '--porcelain').split('\n').filter(Boolean).length
  return { dir, base, branch, commits, files, numstat, uncommitted }
}

// ---------- classify ----------
const isBE = (r) => r === REPOS.be.dir

function area(file, be) {
  if (be) {
    if (file.startsWith('prisma/migrations/')) return 'Prisma migrations'
    if (file.startsWith('prisma/')) return 'Prisma schema / seed'
    if (file.startsWith('test/')) return 'E2E tests'
    const m = file.match(/^src\/([^/]+)\/([^/]+)/)
    if (m && ['accounting', 'pos', 'inventory', 'crm', 'hr', 'auth'].includes(m[1]))
      return `${m[1]}/${m[2].replace(/\.[^.]+$/, '')}`
    return m ? `src/${m[1]}` : 'Other'
  }
  const m = file.match(/^src\/app\/\(app\)\/\(dashboard\)\/([^/]+)\/([^/]+)/)
  if (m) return `${m[1]}/${m[2]}`
  const c = file.match(/^src\/(components|libs|schema)\/([^/]+)/)
  if (c) return `src/${c[1]}/${c[2].replace(/\.[^.]+$/, '')}`
  return file.startsWith('docs/') ? 'Docs' : 'Other'
}

function modules(files, be) {
  const set = new Set()
  for (const { file } of files) {
    const l = file.toLowerCase()
    if (/(^|\/)accounting/.test(l)) set.add('Accounting')
    if (/(^|\/)inventory/.test(l)) set.add('Inventory')
    if (/(^|\/)pos(\/|-|\.)/.test(l)) set.add('POS')
    if (/(^|\/)hr(\/|$)/.test(l)) set.add('Human Resources (HR)')
    if (/(^|\/)(auth|iam)/.test(l)) set.add('Auth / IAM')
    if (/(^|\/)dashboard\/dashboard/.test(l)) set.add('Dashboard')
    if (/src\/(components|libs|schema|common|app\.module)|prisma\/schema/.test(l))
      set.add('Core/Shared')
  }
  return set
}

// ---------- body ----------
const TYPE_TITLES = {
  feat: 'Features',
  fix: 'Fixes',
  refactor: 'Refactors',
  perf: 'Performance',
  docs: 'Docs',
  test: 'Tests',
  chore: 'Chores',
}

const isWip = (c) => c.type === 'wip'

function indentBody(body) {
  return body
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => (/^\s*[-*]\s/.test(l) ? `  ${l.trim().replace(/^\*/, '-')}` : `  ${l.trim()}`))
    .join('\n')
}

function commitsSection(commits) {
  const groups = {}
  const wip = []
  for (const c of commits) {
    if (isWip(c)) {
      if (c.body) wip.push(c)
      continue
    }
    const key = TYPE_TITLES[c.type] ? c.type : 'other'
    ;(groups[key] ||= []).push(c)
  }
  const out = []
  for (const key of [...Object.keys(TYPE_TITLES), 'other']) {
    if (!groups[key]) continue
    out.push(`**${TYPE_TITLES[key] ?? 'Other'}**`)
    for (const c of groups[key]) {
      out.push(`- ${c.scope ? `\`${c.scope}\`: ` : ''}${c.text}`)
      if (c.body) out.push(indentBody(c.body))
    }
    out.push('')
  }
  for (const c of wip) {
    out.push('**Also included (snapshot commit)**')
    out.push(
      c.body
        .split('\n')
        .filter((l) => l.trim())
        .join('\n')
    )
    out.push('')
  }
  return out.join('\n').trim()
}

function filesSection(d, be) {
  const byArea = new Map()
  for (const f of d.files) {
    const a = area(f.file, be)
    const e = byArea.get(a) || { A: 0, M: 0, D: 0, R: 0 }
    e[f.status] = (e[f.status] || 0) + 1
    byArea.set(a, e)
  }
  const rows = [...byArea.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([a, e]) => `| ${a} | ${e.A} | ${e.M} | ${e.D} | ${e.R || 0} |`)
  return [
    `${d.files.length} files changed, +${d.numstat.add} / -${d.numstat.del} vs \`${d.base}\` (${d.commits.length} commits).`,
    '',
    '| Area | Added | Modified | Deleted | Renamed |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

function endpointsSection(d) {
  const ctrl = d.files.filter((f) => f.file.endsWith('.controller.ts') && f.status !== 'D')
  const lines = []
  for (const { file } of ctrl) {
    const diff = git(d.dir, 'diff', '-U0', `${d.base}...HEAD`, '--', file)
    for (const l of diff.split('\n')) {
      const m = l.match(/^\+\s*@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/)
      if (m)
        lines.push(
          `- \`${m[1].toUpperCase()} ${m[2].replace(/['"`]/g, '') || '/'}\` — ${path.basename(file)}`
        )
    }
  }
  return lines.slice(0, 40).join('\n')
}

const newFiles = (d) =>
  d.files
    .filter((f) => f.status === 'A' && !f.file.includes('prisma/migrations/'))
    .map((f) => `- \`${f.file}\``)

function buildBody(d, be, companion) {
  const migrations = [
    ...new Set(
      d.files
        .filter((f) => /^prisma\/migrations\/[^/]+\/migration\.sql$/.test(f.file))
        .map((f) => f.file.split('/')[2])
    ),
  ]
  const parts = []
  if (companion)
    parts.push(
      `> Companion PR: the ${be ? 'frontend' : 'backend'} repo has changes on the same branch (\`${d.branch}\`). Merge and deploy together.\n`
    )
  parts.push(
    '### Summary of everything on this branch\n',
    commitsSection(d.commits) || '_No commits ahead of base._'
  )
  parts.push('\n### Scope\n', filesSection(d, be))
  if (migrations.length)
    parts.push('\n### Migrations\n', migrations.map((m) => `- \`${m}\``).join('\n'))
  if (be) {
    const ep = endpointsSection(d)
    if (ep) parts.push('\n### Endpoints added / changed\n', ep)
  }
  const nf = newFiles(d)
  if (nf.length)
    parts.push(
      `\n### New files (${nf.length})\n`,
      nf.slice(0, 40).join('\n') + (nf.length > 40 ? `\n- …and ${nf.length - 40} more` : '')
    )
  return { text: parts.join('\n'), migrations }
}

// ---------- title ----------
function buildTitle(d) {
  if (args.title && typeof args.title === 'string') return args.title
  const known = Object.keys(TYPE_TITLES)
  const bm = d.branch.match(/^(\w+)\/(.+)$/)
  let type = bm && known.includes(bm[1]) ? bm[1] : null
  if (!type) {
    const counts = {}
    d.commits
      .filter((c) => known.includes(c.type))
      .forEach((c) => (counts[c.type] = (counts[c.type] || 0) + 1))
    type = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'feat'
  }
  const subject = (bm ? bm[2] : d.branch).replace(/[-_]+/g, ' ').trim()
  return `${type}: ${subject}`
}

// ---------- template ----------
function fillTemplate(d, be, body, migrations) {
  const tpl = path.join(d.dir, '.github', 'pull_request_template.md')
  if (!existsSync(tpl)) return body
  let t = readFileSync(tpl, 'utf8')
  t = t.replace(/(## 📋 Description\s*\n)\s*<!--[\s\S]*?-->/, `$1\n${body}\n`)

  const types = new Set(d.commits.map((c) => c.type))
  const mods = modules(d.files, be)
  const has = (re) => d.files.some((f) => re.test(f.file))
  const ticks = [
    [/Bug fix/, types.has('fix')],
    [/New feature/, types.has('feat')],
    [/Refactoring/, types.has('refactor')],
    [/Documentation update/, types.has('docs') || has(/^docs\//)],
    [/Database \/ migration change/, migrations.length > 0],
    [/UI\/Design update/, !be && has(/\.tsx$/)],
    [/New migration included/, migrations.length > 0],
    [/Seed data updated/, has(/^prisma\/(seed|employee|sync)/)],
    [/No database changes/, be && migrations.length === 0 && !has(/^prisma\/schema/)],
    ...[...mods].map((m) => [new RegExp(`^- \\[ \\] ${m.replace(/[()/]/g, '\\$&')}`), true]),
  ]
  t = t
    .split('\n')
    .map((l) => {
      if (!l.startsWith('- [ ] ')) return l
      return ticks.some(([re, on]) => on && re.test(l)) ? l.replace('- [ ]', '- [x]') : l
    })
    .join('\n')

  if (migrations.length)
    t = t.replace(
      /<!-- Describe any migration steps or data concerns -->/,
      migrations.map((m) => `- ${m}`).join('\n')
    )
  t = t.replace(
    /Database migrations: \[ \] Yes \[ \] No/,
    `Database migrations: [${migrations.length ? 'x' : ' '}] Yes [${migrations.length ? ' ' : 'x'}] No`
  )
  return t
}

// ---------- run ----------
function otherHasChanges(key) {
  const other = REPOS[key === 'be' ? 'fe' : 'be']
  try {
    return git(other.dir, 'log', `${baseRef(other.dir)}..HEAD`, '--oneline').length > 0
  } catch {
    return false
  }
}

const keys = args.only ? [args.only] : ['be', 'fe']
const out = []
for (const key of keys) {
  const repo = REPOS[key]
  if (!repo) throw new Error(`--only must be fe or be`)
  const d = collect(repo.dir)
  if (d.uncommitted)
    console.error(
      `⚠ ${repo.label}: ${d.uncommitted} uncommitted change(s) are NOT included — commit them first.`
    )
  const be = isBE(repo.dir)
  const { text, migrations } = buildBody(d, be, otherHasChanges(key))
  const body = fillTemplate(d, be, text, migrations)
  const title = buildTitle(d)
  const block = []
  if (keys.length > 1) block.push(`${'#'.repeat(20)} ${repo.label} ${'#'.repeat(20)}\n`)
  if (args.part !== 'body') block.push(args.part === 'title' ? title : `TITLE:\n${title}\n`)
  if (args.part !== 'title') block.push(args.part === 'body' ? body : `DESCRIPTION:\n${body}`)
  out.push(block.join('\n'))
}
const result = out.join('\n\n')
if (args.copy) {
  execFileSync('pbcopy', { input: result })
  console.error('Copied to clipboard.')
} else {
  console.log(result)
}
