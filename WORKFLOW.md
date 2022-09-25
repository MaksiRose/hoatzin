## Main

The **main** branch is a permanent branch that reflects the latest stable release. Direct commits should not occur. *Hotfix*-branches should branch off of it, and *hotfix*-branches and *release*-branches should merge into it.

## Dev

The **dev** branch is a permanent branch that reflects the latest finished features. Direct commits should only occur for features that have been merged into it but not been released yet. Bugs might still be present in this version. Direct commits are only allowed for minor bug fixes. *Feature*-branches, *fix*-branches and *release*-branches should branch off of it, and *hotfix*-branches, *feature*-branches aand *fix*-branches should merge into it.

## Release

**Release** branches are temporary branches that reflect a testing stage for a upcoming release. They branch off of the *dev*-branch and merge into the *main*-branch. Direct commits should only occur for minor fixes. Nothing should branch off of it and nothing should merge into it.

## Hotfix

**Hotfix** branches are temporary branches for important bugs that needs quick fixing. They branch off of the *main*-branch and merge into the *main*-branch and the *dev*-branch. Direct commits should occur to resolve the bug. Nothing should branch off of it and nothing should merge into it.

## Fix and feature

**Fix/Feature** branches are temporary branches for bugs and features that are worked on for future releases. Direct commits should occur to make progress on the fix or feature. They branch off of the *dev*-branch and merge back into the *dev*-branch.

## Final workflow

1. For severe bugs, created a *hotfix*-branch from main, and merge into main and dev
2. For new features or minor bugs, create a *fix/feature*-branch from dev, and merge into dev
3. When a new release is ready, create a *release*-branch from dev, test and bugfix from that branch, then merge into main

## Notes

1. hotfix, fix and feature branches should follow the naming convention `hotfix-ticketnr`, `fix-ticketnr`, `feature-ticketnr.
2. release branches should follow the naming convention `release-major.minor.patch`, with major, minor and patch being increasing numbers.
