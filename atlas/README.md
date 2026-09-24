# registry-sync: how it works

Mapped at 2026-09-23 from commit e78b5d0.

## What this is

7 parts, mostly TypeScript (38 files). Work enters through 5 doors; the busiest is CI, which reaches 2 parts. It publishes to npm. People run registry-sync. People import @mcptoolshop/registry-sync.

## What changed since the last map

This is the first map.

## What comes in

1. **CI.** On a pull request touching 6 paths; on a push to main touching 6 paths; or by hand. Runs test/.
2. **Publish.** When a release is published; or by hand. Runs test/.
3. **Deploy site to GitHub Pages.** On a push to main touching 2 paths; or by hand. Runs site/astro.config.mjs and site/src/.
4. **@mcptoolshop/registry-sync** (the package people import). Loads src/index.ts.
5. **registry-sync** (a command people run). Runs src/cli.ts.

## What happens through CI

1. The workflow runs test/ in test.
2. That reaches src (18 files).

## Who reads the results

CI writes nothing this map can see.

## The other doors

**Publish** runs test/, reaches src, and publishes to npm.

**Deploy site to GitHub Pages** runs site/astro.config.mjs and site/src/, and deploys the site.

**@mcptoolshop/registry-sync** (the package people import) loads src/index.ts.

**registry-sync** (a command people run) runs src/cli.ts.

## What breaks what

- **src** is imported only from tests, by 1 part (test), and sits on the path of 4 doors.
- **test** is imported by no other part and sits on the path of 2 doors.

## What tends to change together

No two source files changed together often enough to name.

Window: 180 days; a pair counts from 3 shared commits, since the window holds fewer than 30 qualifying commits.

## What no test touches

Every code part is imported by at least one test.

## Written but never read

No place this map can see is written, so none goes unread.

## Helpers that look duplicated

No two parts export a helper that looks alike.

## Generated, never hand-edited

Nothing in this repository writes to a tracked place this map can see.

## Hand-authored

People write .claude/, .github/, the repository root, site/ and templates/; 4 writes with paths built at run time may land here.

## Where to start

.github/workflows/ci.yml → test/apply.test.ts → src/apply.ts

Read those in order to follow one pull request end to end.

## What this map cannot see

- 4 writes and 1 read use paths built at run time and are not named here.
- Statistics confidence is low: fewer than 30 qualifying commits in the window, and fewer than 20 source files reach 10 revisions.

Regenerate with `npx --yes @dogfood-lab/atlas map`.
