# Changesets

A release is described by a markdown file in this folder: which packages
changed, whether it is a patch, a minor or a major, and one line about what
happened. `pnpm changeset` writes one.

The five packages are versioned together — an adapter is meaningless without a
core it matches, and one number across all of them is a shorter conversation
than five.

```
pnpm changeset          # describe a change
pnpm version-packages   # apply every pending change, bump versions, write changelogs
pnpm release            # build, then publish whatever is not on npm yet
```
