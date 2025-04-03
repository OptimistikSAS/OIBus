Developer guidelines for OIBus
==========================

This document list all the development principles applicable to OIBus. It is mandatory to read those instructions and
make sure they are understood and applied throughout the development.

## General principles

The main language used for communicating in the codebase, code comments or comments on issues and pull request is
English.

## Branching strategy

OIBus has two main and immutable active branches.

- `stable` branch is the official code running in production. It is protected against force push and non-linear history.
- `main` is the branch containing the set of new features, dependency update and bug fixes.

## New features & commit procedure

When developing new feature or a bug fix you should always

- Create a new branch from `main` or `stable` to start implementing this feature (bug fix). `stable` should only be for
  urgent bug fix or urgent features. Special attention must be paid to those devs.
- Implement your feature following coding good practice and security awareness (see appropriate sections).
- Once development is done and tests are green you should create a pull request in GitHub to move the development in the
  workflow.

**It is very very important that a pull request contains the minimal amount of code necessary for a given feature**. In
other words it is very important to break down a pull request in its most appropriate granularity. Pull requests that
are too long or impact to many files are significantly harder to read and assess. They can very easily lead to more
regression and bugs.

## Coding good practices

- Commit messages should be formatted the following way:
  `commit-type(scope): clear and concise message in english all in lower case`

- Comment only when necessary. It is better to have good variable and function name then useless comments.

- Pay special attention to code formatting (when code formatting is not handled by a third party tool), in particular do
  not write too long lines as they are hard to read on a laptop.

- Re-read your code once a pull request has been submitted and ask yourself whether this code is understandable for
  yourself and someone who has never seen this code. If not then there is probably something wrong with it.

- For each language and submodules there are specific requirements that you need to follow please read specific
  developer guidelines for each.

Examples:

`fix(opcua): use appropriate timestamp when retrieving data`

`feat(logger): add OIAnalytics pino transport in logger service`

`nit(utils): adjust some comments and code formatting`

`chore(global): move to Angular`

`docs(engine): add documentation about the way the engine works`

## Code integration (Pull Requests)

To integrate any new feature in the main codebase of OIBus (`main` or `stable`) you should proceed in the following way.

- Create a Pull Request in GitHub with an appropriate description of your development and any side note that will help
  review the code. **Note it is very important for UI related development to provide screenshots of the dev (
  before/after if applicable).**
- Your initial Pull Request should be cleaned of work in progress commits to only contains the useful commits.
- Assign a reviewer for your pull request.
- The reviewer will review the code and make any comments on the requested changes.
- You should handle the comments in an additional commit and reassign for review (unless the changes are
  straightforward).
- You should then repeat the review process as many times as it is necessary.
- Once the Pull Request has been approved you should clean the working commits and merge the pull request in the target
  branch.

## Testing

It is very important that every feature / bug fix is tested. You should always test your code in two ways.

- Automated unit tests directly embedded in the code base.
- Manual testing of as many corner case as possible.

**Code without a proper automated test will be rejected during review**

## Production release

The production release procedure is managed by the repository maintainer. It involves the following steps:

- `release-please` automated GitHub action update the `release-please--branches--stable` branch with latest commits from
  `stable`
- Merge the `release-please--branches--stable` branch into the `stable` branch using a dedicated pull request
- Trigger the `stable` release through an automated GitHub action

## Security awareness

Every developer should be aware of the security threats that can arise from new developments. In any case for every
development that is linked to security related features (authentication, profile, users, permissions ...), it is
important to make a technical meeting before starting development to assess the risks and agree on the design.