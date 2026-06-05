---
sidebar_position: 4
---

# Software Bill of Materials (SBOM)

A **Software Bill of Materials (SBOM)** is a machine-readable inventory of all components, libraries,
and dependencies that make up a software product — including their versions, licenses, and supply-chain
relationships. SBOMs are used by security teams, compliance officers, and vulnerability scanners to
assess the risk exposure of a software deployment.

## Format

OIBus publishes its SBOM in **[CycloneDX](https://cyclonedx.org/) JSON** format, generated with
[`cdxgen`](https://github.com/CycloneDX/cdxgen). CycloneDX is a widely-supported open standard backed
by OWASP, with native tool support across the security ecosystem.

The SBOM covers the entire repository (backend, frontend, and launcher) and is regenerated from scratch
on every release build.

## Downloading the SBOM

The SBOM is available in two places for every stable release:

### GitHub Releases (recommended)

Each stable release attaches `oibus-sbom.json` as a release asset. You can download it directly:

```
https://github.com/OptimistikSAS/OIBus/releases/latest/download/oibus-sbom.json
```

For a specific version, replace `latest` with the tag name:

```
https://github.com/OptimistikSAS/OIBus/releases/download/v3.x.y/oibus-sbom.json
```

All release assets are listed on the [Releases page](https://github.com/OptimistikSAS/OIBus/releases).

### Bundled inside the binary archive

Each platform archive (`oibus-win-x64.zip`, `oibus-linux-x64.tar.gz`, …) includes
`oibus-sbom.json` alongside the binary. If you have already downloaded and unpacked OIBus, the SBOM
file is already present in the same directory as the `oibus` or `oibus.exe` executable.

:::note
The SBOM is only attached to **stable** (non-prerelease) releases. Pre-release and nightly builds produce
the SBOM as a CI artifact but do not publish it to the release page.
:::

## Using the SBOM

The CycloneDX JSON file can be consumed by any compatible tool. The most common use cases are:

### Vulnerability scanning

| Tool                                                     | Command                              |
| -------------------------------------------------------- | ------------------------------------ |
| **[Grype](https://github.com/anchore/grype)**            | `grype sbom:oibus-sbom.json`         |
| **[Trivy](https://trivy.dev/)**                          | `trivy sbom oibus-sbom.json`         |
| **[OSV-Scanner](https://google.github.io/osv-scanner/)** | `osv-scanner --sbom oibus-sbom.json` |

### Continuous monitoring

[OWASP Dependency-Track](https://dependencytrack.org/) accepts CycloneDX SBOMs and continuously
monitors uploaded components against multiple vulnerability databases (NVD, OSV, GitHub Advisories,
…). Upload `oibus-sbom.json` via its REST API or web UI to track OIBus's risk posture over time.

### License compliance

Tools such as [FOSSA](https://fossa.com/) and
[CycloneDX CLI](https://github.com/CycloneDX/cyclonedx-cli) can parse the SBOM to produce license
inventories, flag copyleft dependencies, or generate compliance reports.

### Viewing the SBOM

To inspect the raw SBOM without any external tooling, open `oibus-sbom.json` in a text editor or
pipe it through `jq`:

```bash
jq '.components[] | {name, version, licenses}' oibus-sbom.json
```

## Generation process

The SBOM is produced automatically by the [build pipeline](https://github.com/OptimistikSAS/OIBus/blob/main/.github/workflows/build.yml)
on every release event using:

```bash
cdxgen . -o oibus-sbom.json --recurse
```

The `--recurse` flag ensures that nested workspaces (backend, frontend, launcher) are all included
in a single merged document. The pipeline runs this step before the platform binaries are compiled,
so the SBOM always reflects the exact dependency set used to produce that release.
