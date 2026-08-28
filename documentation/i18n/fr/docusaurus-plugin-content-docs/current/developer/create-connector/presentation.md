---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# Créer un nouveau connecteur OIBus

Les connecteurs OIBus sont écrits en [TypeScript](https://www.typescriptlang.org/). Les connecteurs **South**
_récupèrent_ des données depuis une source (automate, système de fichiers, base de données, broker MQTT, etc.) ;
les connecteurs **North** les _livrent_ à une destination (fichier, OIAnalytics, serveur OPC UA, S3, etc.).

Ce guide passe en revue l'organisation des fichiers, le modèle mental, et les étapes de câblage nécessaires pour
enregistrer un nouveau connecteur auprès du moteur.

:::tip Avant de commencer
Contactez l'équipe OIBus si vous n'êtes pas sûr par où commencer — ce dont vous avez besoin pourrait déjà être
pris en charge par un connecteur existant, ou pourrait mieux convenir en tant qu'amélioration de l'un d'eux.
:::

## Organisation des fichiers {#file-layout}

Chaque connecteur vit dans son propre dossier sous `backend/src/north/` ou `backend/src/south/` :

```
backend/src/south/south-<type>/
├── manifest.ts                  ← form schema: settings + items
├── south-<type>.ts              ← the connector class
└── south-<type>.spec.ts         ← unit tests (target 100% coverage)
```

```
backend/src/north/north-<type>/
├── manifest.ts                  ← form schema: settings only
├── north-<type>.ts              ← the connector class
└── north-<type>.spec.ts         ← unit tests
```

Les connecteurs qui partagent des utilitaires spécifiques à un protocole (analyse syntaxique, gestion des
certificats, utilitaires réseau) les extraient généralement dans `backend/src/service/utils-<type>.ts` afin que
la classe du connecteur reste centrée sur le cycle de vie et l'orchestration. Exemples : `service/utils-opcua.ts`,
`service/utils-mqtt.ts`, `service/utils-modbus.ts`.

## Modèle mental {#mental-model}

|                       | **South**                                                    | **North**                                        |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Direction             | Tire _depuis_ une source                                     | Pousse _vers_ une destination                     |
| Déclencheur           | Cron (mode de scan), push d'abonnement, ou requête directe | Extraction _pull_ cadencée par cron depuis un cache de fichiers local |
| Sortie                | Pousse des lots vers le moteur via `this.addContent(...)`    | Implémente `handleContent(fileStream, metadata)` |
| État persistant       | `trackedInstant` par item, mis en cache pour des lectures historiques reprenables | Cache par fichier → dossiers d'archive / d'erreurs |

Les lots South sont écrits dans le cache de fichiers par North du moteur par le moteur lui-même ; chaque North
puise ensuite dans ce cache à sa propre cadence. Ce découplage signifie qu'une destination défaillante ne bloque
pas l'ingestion South — les fichiers s'accumulent simplement dans le cache et sont retentés au tick suivant.

## Étapes d'enregistrement {#registration-steps}

Ajouter un nouveau type de connecteur nécessite quatre modifications en plus du dossier du connecteur. Le
compilateur TypeScript détecte les trois premières ; la quatrième est une vérification à l'exécution.

### 1. Ajouter l'id du type à la liste partagée {#1-add-the-type-id-to-the-shared-list}

Pour un connecteur South, ajoutez votre id à `OIBUS_SOUTH_TYPES` dans
`backend/shared/model/south-connector.model.ts` :

```typescript title="backend/shared/model/south-connector.model.ts"
export const OIBUS_SOUTH_TYPES = [
  // ...existing types...
  'my-new-source' // ← your new type id (kebab-case)
] as const;
```

Les connecteurs North utilisent `OIBUS_NORTH_TYPES` dans `backend/shared/model/north-connector.model.ts`.

Choisissez une `category` parmi la liste existante (`OIBUS_SOUTH_CATEGORIES` ou `OIBUS_NORTH_CATEGORIES`).
N'ajoutez pas de nouvelle catégorie sans raison valable — l'interface regroupe les connecteurs par catégorie, et
une catégorie isolée rend ce regroupement moins utile.

### 2. S'enregistrer dans la fabrique (factory) {#2-register-in-the-factory}

La fabrique construit une instance de connecteur à partir d'une ligne de configuration enregistrée. Ajoutez un
`case` pour votre type :

```typescript title="backend/src/south/south-connector-factory.ts"
case 'my-new-source':
  return new SouthMyNewSource(
    settings as SouthConnectorEntity<SouthMyNewSourceSettings, SouthMyNewSourceItemSettings>,
    addContent,
    southCacheRepository,
    logger,
    southCacheFolder
  );
```

L'équivalent North est `buildNorth(...)` dans `backend/src/north/north-connector-factory.ts`.

### 3. Associer l'id de type au nom de l'interface de paramètres générée {#3-map-the-type-id-to-the-generated-settings-interface-name}

Les types de paramètres (`South<Type>Settings`, `South<Type>ItemSettings`) sont générés à partir du manifeste.
Indiquez au générateur comment les nommer dans `backend/src/settings-interface.generator.ts` :

```typescript title="backend/src/settings-interface.generator.ts"
function buildSouthInterfaceName(connectorId: string, itemInterface: boolean): string {
  const prefix = itemInterface ? 'Item' : '';
  switch (connectorId) {
    // ...
    case 'my-new-source':
      return `SouthMyNewSource${prefix}Settings`;
  }
}
```

Puis régénérez depuis `backend/` :

```bash
npm run generate:settings-interface
```

Cela lit chaque `manifest.ts`, dérive l'interface TypeScript correspondante, et l'écrit dans
`backend/shared/model/south-settings.model.ts` (et l'équivalent North). Le générateur actualise également les
définitions OpenAPI.

:::caution
Lors de la première exécution après l'ajout d'un nouveau type, les types générés n'existent pas encore — c'est
normal. Une fois qu'elle est terminée, la classe de votre connecteur se compilera contre les types fraîchement
générés.
:::

### 4. Clés de traduction {#4-translation-keys}

Chaque `translationKey` de votre manifeste doit se résoudre en une chaîne dans les paquets i18n du frontend
(`frontend/src/assets/i18n/*.json`). La convention est
`configuration.oibus.manifest.<south|north>.<connector-type>.<field>`. Les clés manquantes retombent sur la clé
elle-même — l'interface continue de fonctionner, elle a juste un rendu approximatif.

## Et ensuite {#whats-next}

- **[Le manifeste](./manifest.md)** — schéma des paramètres, types d'attributs, validateurs, affichage
  conditionnel.
- **[La classe du connecteur](./class.md)** — classes de base, interfaces de capacité, cycle de vie, exemples.
