---
sidebar_position: 4
---

# Nomenclature logicielle (SBOM)

Une **Nomenclature logicielle (Software Bill of Materials, SBOM)** est un inventaire lisible par machine de tous les composants,
bibliothèques et dépendances qui constituent un produit logiciel — y compris leurs versions, licences, et relations
de chaîne d'approvisionnement. Les SBOM sont utilisées par les équipes de sécurité, les responsables de la conformité, et les
scanners de vulnérabilités pour évaluer l'exposition au risque d'un déploiement logiciel.

## Format {#format}

OIBus publie sa SBOM au format **[CycloneDX](https://cyclonedx.org/) JSON**, généré avec
[`cdxgen`](https://github.com/CycloneDX/cdxgen). CycloneDX est une norme ouverte largement supportée, soutenue
par l'OWASP, avec un support natif des outils dans tout l'écosystème de la sécurité.

La SBOM couvre l'intégralité du dépôt (backend, frontend et launcher) et est régénérée depuis zéro
à chaque build de release.

## Télécharger la SBOM {#downloading-the-sbom}

La SBOM est disponible à deux endroits pour chaque release stable :

### GitHub Releases (recommandé) {#github-releases-recommended}

Chaque release stable joint `oibus-sbom.json` en tant qu'asset de release. Vous pouvez le télécharger directement :

```
https://github.com/OptimistikSAS/OIBus/releases/latest/download/oibus-sbom.json
```

Pour une version spécifique, remplacez `latest` par le nom du tag :

```
https://github.com/OptimistikSAS/OIBus/releases/download/v3.x.y/oibus-sbom.json
```

Tous les assets de release sont listés sur la [page Releases](https://github.com/OptimistikSAS/OIBus/releases).

### Intégrée dans l'archive binaire {#bundled-inside-the-binary-archive}

Chaque archive de plateforme (`oibus-win_x64-<version>.zip`, `oibus-linux_x64-<version>.zip`, …) inclut
`oibus-sbom.json` aux côtés du binaire. Si vous avez déjà téléchargé et décompressé OIBus, le fichier SBOM
est déjà présent dans le même répertoire que l'exécutable `oibus` ou `oibus.exe`.

:::note
La SBOM n'est jointe qu'aux releases **stables** (non pré-release). Les builds de pré-release produisent la SBOM
en tant qu'artefact CI mais ne la publient pas sur la page de release.
:::

## Utiliser la SBOM {#using-the-sbom}

Le fichier JSON CycloneDX peut être consommé par tout outil compatible. Les cas d'usage les plus courants sont :

### Analyse de vulnérabilités {#vulnerability-scanning}

| Outil                                                     | Commande                              |
| --------------------------------------------------------- | ------------------------------------- |
| **[Grype](https://github.com/anchore/grype)**              | `grype sbom:oibus-sbom.json`          |
| **[Trivy](https://trivy.dev/)**                             | `trivy sbom oibus-sbom.json`          |
| **[OSV-Scanner](https://google.github.io/osv-scanner/)**    | `osv-scanner --sbom oibus-sbom.json`  |

### Surveillance continue {#continuous-monitoring}

[OWASP Dependency-Track](https://dependencytrack.org/) accepte les SBOM CycloneDX et surveille en continu
les composants téléversés par rapport à plusieurs bases de données de vulnérabilités (NVD, OSV, GitHub Advisories,
…). Téléversez `oibus-sbom.json` via son API REST ou son interface web pour suivre la posture de risque d'OIBus dans le temps.

### Conformité des licences {#license-compliance}

Des outils tels que [FOSSA](https://fossa.com/) et
[CycloneDX CLI](https://github.com/CycloneDX/cyclonedx-cli) peuvent analyser la SBOM pour produire des inventaires
de licences, signaler les dépendances copyleft, ou générer des rapports de conformité.

### Visualiser la SBOM {#viewing-the-sbom}

Pour inspecter la SBOM brute sans outillage externe, ouvrez `oibus-sbom.json` dans un éditeur de texte ou
transmettez-le via `jq` :

```bash
jq '.components[] | {name, version, licenses}' oibus-sbom.json
```

## Processus de génération {#generation-process}

La SBOM est produite automatiquement par le [pipeline de build](https://github.com/OptimistikSAS/OIBus/blob/main/.github/workflows/build.yml)
à chaque événement de release, en utilisant :

```bash
cdxgen . -o oibus-sbom.json --recurse
```

Le drapeau `--recurse` garantit que les workspaces imbriqués (backend, frontend, launcher) sont tous inclus
dans un seul document fusionné. Le pipeline exécute cette étape avant que les binaires de plateforme ne soient compilés,
de sorte que la SBOM reflète toujours l'ensemble exact des dépendances utilisées pour produire cette release.
