# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

### Installation

```
$ npm i
```

### Local Development

```
$ npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the
server.

### Build

This site has two build variants, controlled by the `DOCS_BUILD_TARGET` environment variable:

```
$ npm run build
```

The default (**public**) build generates static content into the `build` directory, served at
`https://oibus.optimistik.com/` (base URL `/`), with Algolia-hosted search. This is what `npm run deploy`
below publishes.

```
$ npm run build:embedded
```

The **embedded** build (`DOCS_BUILD_TARGET=embedded`) is what the OIBus backend actually bundles and
serves locally, under the `/documentation` path prefix (see `backend/src/web-server/web-server.ts`) — this
is what powers the in-app **Help** links and the documentation viewable from a running OIBus instance with
no internet access. It differs from the public build in two ways: its base URL is `/documentation/` instead
of `/`, and it uses a local, offline search index (`@easyops-cn/docusaurus-search-local`) instead of
Algolia, since an offline instance can't reach Algolia's cloud service. See `.github/workflows/build.yml`'s
`build-documentation` job for how CI builds this variant and feeds its output into `backend/dist/documentation`
before the backend is packaged.

Both build commands also run `update-agent-version.js` afterwards, which fetches the latest
[OIBus Agent](https://github.com/OptimistikSAS/OIBusAgentRelease) release tag and substitutes it into the
built pages wherever a version placeholder is used.

### Deployment

Using SSH:

```
$ USE_SSH=true npm run deploy
```

Not using SSH:

```
$ GIT_USER=<Your GitHub username> npm run deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
