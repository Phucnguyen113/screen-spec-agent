# Upstream

This kit is a fork of [obra/superpowers](https://github.com/obra/superpowers)
(MIT, Copyright (c) 2025 Jesse Vincent), imported as a git subtree.

Base tag: `v7.0.2`

## Syncing

```sh
git subtree pull --prefix=apps/agent-kit https://github.com/obra/superpowers <tag> --squash
```

Rule: resolve conflicts only inside `screen-spec:` blocks (our additions to
upstream files). Take upstream for everything else. Then run the kit tests:

```sh
pnpm --filter @screen-spec/agent-kit test
```

Update `upstream.tag` in `kit.config.json` and the base tag above after a sync.

## After a subtree sync

Some things a subtree pull can overwrite and conflict markers cannot protect:

- `package.json`: JSON cannot hold `screen-spec:` markers. Re-apply `name` (`@screen-spec/agent-kit`), `"private": true` and `scripts.test` (`node --test "screen-spec/tests/**/*.test.mjs"`).
- `screen-spec/.gitignore`: the `!evals/` exception must survive, or the evals directory is ignored again.
