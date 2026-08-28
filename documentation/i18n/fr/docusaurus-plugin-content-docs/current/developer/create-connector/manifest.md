---
displayed_sidebar: developerSidebar
sidebar_position: 2
---

# Le manifeste

Le manifeste est un fichier TypeScript (typé comme `SouthConnectorManifest` ou `NorthConnectorManifest`) qui
déclare :

- **Ce qu'est le connecteur** — id, catégorie, modes pris en charge (South) ou types de contenu (North)
- **Les paramètres que l'opérateur peut configurer** — URL de connexion, identifiants, options spécifiques au
  protocole
- **Pour South : à quoi ressemble un item** — quelle valeur interroger, l'acceptabilité du mode de scrutation,
  les paramètres spécifiques à l'item

Le frontend restitue le manifeste sous forme de formulaire ; le générateur de types du backend produit les
interfaces TypeScript correspondantes (`South<Type>Settings`, `South<Type>ItemSettings`, `North<Type>Settings`).

## Forme de haut niveau {#top-level-shape}

### South {#south}

```typescript title="backend/src/south/south-folder-scanner/manifest.ts (excerpt)"
import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'folder-scanner', // must be in OIBUS_SOUTH_TYPES
  category: 'file', // 'file' | 'iot' | 'database' | 'api'
  modes: {
    subscription: false, // class implements SouthSubscription?
    lastPoint: false, // class implements SouthDirectQuery for a point?
    lastFile: true, // class implements SouthDirectQuery for a file?
    history: false // class implements SouthHistoryQuery?
  },
  settings: {/* OIBusObjectAttribute — see below */},
  items: {/* OIBusArrayAttribute — see below */}
};

export default manifest;
```

Les indicateurs `modes` sont _indicatifs_ — ils indiquent à l'interface quelles actions exposer (par ex. s'il faut
afficher « créer une requête historique » pour ce type de connecteur). La capacité réelle à l'exécution est
déterminée par les interfaces de `south-interface.ts` que la classe implémente ; voir
[la doc de la classe](./class.md#capability-interfaces-south-only).

### North {#north}

```typescript title="backend/src/north/north-console/manifest.ts"
import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'console', // must be in OIBUS_NORTH_TYPES
  category: 'debug', // 'debug' | 'api' | 'file' | 'iot'
  types: ['any', 'time-values', 'setpoint'], // content types this North can deliver
  settings: {/* OIBusObjectAttribute */}
};

export default manifest;
```

North n'a pas d'`items`. Le tableau `types` DOIT correspondre à ce que la classe retourne depuis
`supportedTypes()` — le moteur le vérifie à l'exécution et route les types non pris en charge vers le dossier
d'erreurs.

## L'objet settings {#the-settings-object}

`settings` est toujours un `OIBusObjectAttribute` :

```typescript
{
  type: 'object',
  key: 'settings',
  translationKey: 'configuration.oibus.manifest.<south|north>.settings',
  displayProperties: { visible: true, wrapInBox: false },
  enablingConditions: [],
  validators: [],
  attributes: [ /* child attributes — your form fields */ ]
}
```

Chaque enfant de `attributes` est un contrôle de formulaire. Les conteneurs (`object`, `array`) peuvent eux-mêmes
contenir d'autres attributs — l'imbrication est illimitée.

### Types d'attributs {#attribute-types}

| `type`            | Élément d'interface       | Type TypeScript généré    | Champs supplémentaires                                                          |
| ----------------- | -------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| `'string'`        | Champ de texte              | `string \| null`          | `defaultValue`                                                                  |
| `'number'`        | Champ numérique             | `number \| null`          | `defaultValue`, `unit` (e.g. `'ms'`, `'MB'`)                                    |
| `'boolean'`       | Bascule / case à cocher     | `boolean`                 | `defaultValue`                                                                  |
| `'secret'`        | Champ de mot de passe (masqué) | `string \| null`          | (chiffré au repos par OIBus)                                                    |
| `'string-select'` | Liste déroulante            | `string \| null`          | `selectableValues: Array<string>`, `defaultValue`                               |
| `'code'`          | Éditeur Codemirror          | `string \| null`          | `contentType: 'sql' \| 'json'`, `defaultValue`                                  |
| `'instant'`       | Sélecteur de date + heure    | `Instant \| null`         | —                                                                               |
| `'timezone'`      | Sélection de fuseau horaire  | `string \| null`          | `defaultValue`                                                                  |
| `'scan-mode'`     | Sélection de mode de scrutation | `ScanMode`                | `acceptableType: 'POLL' \| 'SUBSCRIPTION' \| 'SUBSCRIPTION_AND_POLL'`           |
| `'certificate'`   | Sélecteur de certificat      | `string \| null`          | —                                                                               |
| `'object'`        | Conteneur de groupe          | objet imbriqué             | `attributes`, `displayProperties: { visible, wrapInBox }`, `enablingConditions` |
| `'array'`         | Lignes répétables            | `Array<T>`                | `paginate`, `numberOfElementPerPage`, `rootAttribute`                           |

Chaque attribut feuille porte les mêmes champs communs :

| Champ               | Objet                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `key`               | nom de champ en camelCase — devient la propriété TypeScript                                          |
| `translationKey`    | clé i18n pour le libellé                                                                             |
| `validators`        | Tableau de `{ type, arguments }` — voir ci-dessous                                                    |
| `displayProperties` | `{ row, columns, displayInViewMode }` pour les attributs feuilles, ou `{ visible, wrapInBox }` pour les objets |

### Un exemple concret {#a-concrete-example}

```typescript title="One simple string attribute"
{
  type: 'string',
  key: 'inputFolder',
  translationKey: 'configuration.oibus.manifest.south.folder-scanner.input-folder',
  defaultValue: './input/',
  validators: [
    { type: 'REQUIRED', arguments: [] }
  ],
  displayProperties: {
    row: 0,        // 0-indexed row in the form
    columns: 12,   // Bootstrap-style 12-column grid → 12 = full width
    displayInViewMode: true
  }
}
```

```typescript title="A select with three options"
{
  type: 'string-select',
  key: 'authenticationType',
  translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.type',
  selectableValues: ['none', 'basic', 'cert'],
  defaultValue: 'none',
  validators: [{ type: 'REQUIRED', arguments: [] }],
  displayProperties: { row: 2, columns: 4, displayInViewMode: false }
}
```

```typescript title="A secret that's only required when auth = basic"
// Declared as a sibling of authenticationType; visibility is controlled by an
// enablingCondition on the PARENT object (see below).
{
  type: 'secret',
  key: 'password',
  translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.password',
  validators: [{ type: 'REQUIRED', arguments: [] }],
  displayProperties: { row: 3, columns: 4, displayInViewMode: false }
}
```

### Validateurs {#validators}

```typescript
validators: [
  { type: 'REQUIRED', arguments: [] },
  { type: 'MINIMUM', arguments: ['1'] }, // numeric, e.g. number must be ≥ 1
  { type: 'MAXIMUM', arguments: ['65535'] },
  { type: 'POSITIVE_INTEGER', arguments: [] },
  { type: 'VALID_CRON', arguments: [] },
  { type: 'PATTERN', arguments: ['^[A-Z]{3}-\\d+$'] }, // regex; backslashes need escaping
  { type: 'UNIQUE', arguments: [] }, // value unique within the parent array
  { type: 'SINGLE_TRUE', arguments: [] }, // exactly one sibling boolean may be true
  { type: 'MQTT_TOPIC_OVERLAP', arguments: [] } // MQTT-specific: no overlapping topics in an array
];
```

Les arguments des validateurs sont toujours des chaînes ; le frontend les analyse selon le type de validateur.

Les champs masqués (voir les [conditions d'activation](#enabling-conditions)) ignorent leurs validateurs — un
champ obligatoire mais masqué ne bloquera pas la soumission du formulaire.

### Conditions d'activation {#enabling-conditions}

Affiche ou masque des attributs selon la valeur d'un autre champ. Déclarées sur l'**objet parent**, pas sur
chaque attribut :

```typescript title="Show 'username' and 'password' only when authentication.type === 'basic'"
{
  type: 'object',
  key: 'authentication',
  translationKey: 'configuration.oibus.manifest.south.mqtt.authentication',
  displayProperties: { visible: true, wrapInBox: true },
  enablingConditions: [
    {
      referralPathFromRoot: 'authentication.type',
      targetPathFromRoot: 'authentication.username',
      values: ['basic'],
      operator: 'EQUALS'  // optional: 'EQUALS' (default) | 'NOT_EQUAL' | 'CONTAINS'
    },
    {
      referralPathFromRoot: 'authentication.type',
      targetPathFromRoot: 'authentication.password',
      values: ['basic']
    }
  ],
  validators: [],
  attributes: [
    { type: 'string-select', key: 'type', /* ... */ },
    { type: 'string', key: 'username', /* ... */ },
    { type: 'secret', key: 'password', /* ... */ }
  ]
}
```

Les chemins sont pointés, relatifs à la **racine de l'objet englobant** (pas à la racine du formulaire).

## Items (South uniquement) {#items-south-only}

`items` décrit le sous-formulaire par item. C'est un `OIBusArrayAttribute` dont le `rootAttribute` est
l'`OIBusObjectAttribute` définissant une ligne :

```typescript title="Typical items shape"
items: {
  type: 'array',
  key: 'items',
  translationKey: 'configuration.oibus.manifest.south.items',
  paginate: true,
  numberOfElementPerPage: 20,
  validators: [],
  rootAttribute: {
    type: 'object',
    key: 'item',
    translationKey: 'configuration.oibus.manifest.south.items.item',
    displayProperties: { visible: true, wrapInBox: false },
    enablingConditions: [],
    validators: [],
    attributes: [
      // The three always-present item attributes:
      { type: 'string',  key: 'name',     /* required, unique */ },
      { type: 'boolean', key: 'enabled',  defaultValue: true, /* ... */ },
      {
        type: 'scan-mode',
        key: 'scanMode',
        acceptableType: 'POLL',           // 'POLL' | 'SUBSCRIPTION' | 'SUBSCRIPTION_AND_POLL'
        translationKey: 'configuration.oibus.manifest.south.items.scan-mode',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },

      // Connector-specific settings under a nested object:
      {
        type: 'object',
        key: 'settings',
        translationKey: 'configuration.oibus.manifest.south.items.settings',
        displayProperties: { visible: true, wrapInBox: true },
        enablingConditions: [],
        validators: [],
        attributes: [
          // your item-specific fields here
        ]
      }
    ]
  }
}
```

`scanMode.acceptableType` contrôle ce que l'opérateur peut choisir :

| Valeur                    | Effet                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `'POLL'`                  | Périodique uniquement (par défaut pour la plupart des connecteurs South)             |
| `'SUBSCRIPTION'`          | Piloté par événements uniquement — à utiliser quand le connecteur ne prend en charge QUE les abonnements (par ex. MQTT) |
| `'SUBSCRIPTION_AND_POLL'` | Les deux sont valides par item (OPC UA : certains items scrutés, d'autres abonnés)   |

Un exemple réel complet se trouve dans `backend/src/south/south-folder-scanner/manifest.ts`.

## Génération des types TypeScript {#generating-the-typescript-types}

Après avoir modifié le manifeste, régénérez les interfaces de paramètres typées depuis `backend/` :

```bash
npm run generate:settings-interface
```

Le script lit chaque `manifest.ts`, dérive le type TypeScript correspondant, et l'écrit dans
`backend/shared/model/south-settings.model.ts` (et l'équivalent North). Il actualise également les définitions
OpenAPI.

:::caution Les changements de schéma sont des changements incompatibles
Si vous modifiez la `key`, le `type` ou la position d'un champ dans le tableau `attributes` de son parent,
l'interface générée change. Les configurations de connecteurs existantes enregistrées dans la base de données
peuvent nécessiter une migration — ajoutez-en une dans `backend/src/migration/entity-migrations/`.
:::
