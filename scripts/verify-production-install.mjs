#!/usr/bin/env node
// Install each published package alone into an empty project and require() it.
//
// This exists because the same defect has now shipped twice: a package imports something it
// never declared, and nothing local notices because the monorepo's dev tree happens to have it.
// `axios` went out that way in 1.1.1 and every request to the demo's frontend 500'd until
// rollback; `@opentelemetry/api` was sitting in devDependencies of four packages with exactly
// the same failure waiting behind it.
//
// Neither a build nor a test catches this — both run inside the dev tree, where the missing
// dependency is present. Only a clean production install does.
//
// It checks the **registry**, not a local `npm pack`, for two reasons: that is literally what a
// user gets, and the dependents declare `@monoscopetech/common` as `workspace:*`, which npm
// cannot resolve from a local tarball but pnpm rewrites to a real version when publishing. So
// this runs *after* publish. That is later than ideal, but it is the difference between finding
// out from a gate and finding out from a production incident.
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// `importable: false` means install-only. Importing @monoscopetech/adonis pulls in
// @adonisjs/core, which boots the framework at module scope (`await app.booted(...)`) and needs
// a host application — so a failure there says nothing about our packaging. The install half
// still runs, and that is the half that catches an undeclared dependency.
const packages = [
  { dir: 'common', importable: true },
  { dir: 'express', importable: true },
  { dir: 'fastify', importable: true },
  { dir: 'nextjs', importable: true },
  { dir: 'adonis', importable: false },
]
const root = new URL('..', import.meta.url).pathname
const failures = []

// npm serves a just-published version from a CDN that can lag the publish, and not uniformly:
// on the 1.3.1 release four packages resolved immediately while @monoscopetech/next was still
// 404ing 37s later. The budget below (~84s) is sized for that, because a gate that reports a
// successful publish as broken gets ignored, and then it is not a gate.
const withRetry = (fn, attempts = 8) => {
  for (let i = 1; ; i++) {
    try {
      return fn()
    } catch (err) {
      if (i >= attempts) throw err
      execSync(`sleep ${i * 3}`)
    }
  }
}

for (const { dir, importable } of packages) {
  const { name, version } = JSON.parse(
    readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8')
  )
  const work = mkdtempSync(join(tmpdir(), `verify-${dir}-`))
  try {
    execSync('npm init -y', { cwd: work, stdio: 'ignore' })
    // --omit=dev is the whole point: devDependencies must not be what makes it importable.
    withRetry(() =>
      execSync(`npm install --omit=dev --no-audit --no-fund ${name}@${version}`, {
        cwd: work,
        stdio: 'pipe',
      })
    )
    // `import()` rather than `require()`: it loads both CJS and ESM, whereas require() throws
    // ERR_REQUIRE_ASYNC_MODULE on an ESM package — a failure about the check itself rather than
    // about the package, which is exactly the kind of noise that gets a gate muted.
    if (importable) {
      execSync(`node --input-type=module -e "await import('${name}')"`, { cwd: work, stdio: 'pipe' })
    }
    console.log(`  ok   ${name}@${version}${importable ? '' : ' (install only)'}`)
  } catch (err) {
    const detail = (err.stderr?.toString() || err.message).split('\n').slice(0, 4).join('\n')
    console.error(`  FAIL ${name}@${version}\n${detail}`)
    failures.push(`${name}@${version}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

if (failures.length) {
  console.error(
    `\n${failures.length} package(s) cannot be required from a production install: ${failures.join(', ')}.` +
      `\nUsually this means something the package imports is only in devDependencies.`
  )
  process.exit(1)
}
console.log('All packages install and import cleanly with --omit=dev.')
