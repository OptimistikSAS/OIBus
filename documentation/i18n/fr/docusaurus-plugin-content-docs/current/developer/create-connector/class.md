---
displayed_sidebar: developerSidebar
sidebar_position: 3
---

# La classe du connecteur

Une classe de connecteur étend `NorthConnector<TSettings>` ou `SouthConnector<TSettings, TItemSettings>` et
surcharge un petit nombre de méthodes. Les classes de base gèrent les tâches cron, la mise en file d'attente,
les nouvelles tentatives, le cache local, ainsi que le flux `stop()` / déconnexion — votre sous-classe se concentre
sur la logique spécifique au protocole.

Les deux classes de base disposent d'une JSDoc détaillée couvrant chaque méthode du cycle de vie et les contrats
entre elles. Cette page est une référence rapide ; pour les détails approfondis, consultez
`backend/src/south/south-connector.ts` et `backend/src/north/north-connector.ts`.

## Connecteurs North {#north-connectors}

### Exemple minimal complet {#minimal-complete-example}

```typescript title="backend/src/north/north-console/north-console.ts"
import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthConsoleSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult, OIBusSetpoint, OIBusTimeValue } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CacheService from '../../service/cache/cache.service';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';

export default class NorthConsole extends NorthConnector<NorthConsoleSettings> {
  constructor(configuration: NorthConnectorEntity<NorthConsoleSettings>, logger: pino.Logger, cacheService: CacheService) {
    super(configuration, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any', 'time-values', 'setpoint'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    if (!process.stdout.writable) {
      throw new Error('process.stdout is not writable');
    }
    return { items: [] };
  }

  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'time-values': {
        const values = JSON.parse(await streamToString(fileStream)) as Array<OIBusTimeValue>;
        console.table(values, ['pointId', 'timestamp', 'data']);
        return;
      }
      case 'setpoint': {
        const setpoints = JSON.parse(await streamToString(fileStream)) as Array<OIBusSetpoint>;
        console.table(setpoints, ['reference', 'value']);
        return;
      }
      case 'any':
        console.log(`Sending file ${cacheMetadata.contentFile} (${cacheMetadata.contentSize} bytes)`);
        return;
    }
  }
}
```

### Méthodes obligatoires {#required-methods}

| Méthode                                                 | Objet                                                                                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supportedTypes(): Array<string>`                      | Les valeurs de `contentType` que ce North peut livrer. **Doit correspondre au tableau `types` du manifeste.** Les types non pris en charge sont routés vers le dossier d'erreurs. |
| `testConnection(): Promise<OIBusConnectionTestResult>` | Sonde la destination avec les paramètres actuels. Lève une exception en cas d'échec — le message est affiché à l'utilisateur. Retourne un `{ items: [...] }` de diagnostics en cas de succès. |
| `handleContent(fileStream, metadata): Promise<void>`   | Livre effectivement une charge utile mise en cache. Peut lever une exception — la classe de base gère la nouvelle tentative et le dossier d'erreurs.     |

### Surcharges optionnelles {#optional-overrides}

| Méthode        | Quand la surcharger                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `connect()`    | Ouvrir une session / un socket / un client HTTP persistant. Appelez `super.connect()` une fois votre transport prêt.        |
| `disconnect()` | Fermer votre transport. Appelez `super.disconnect()` à la fin. Doit être idempotent (peut être appelé plus d'une fois sans problème). |

### Sémantique de nouvelle tentative {#retry-semantics}

Lorsque `handleContent` lève une exception, le fichier reste dans le cache et `errorCount` s'incrémente. La classe de
base retente à la prochaine exécution cron. Après `caching.error.retryCount` échecs, le fichier est déplacé vers le
dossier d'erreurs afin que le reste de la file d'attente puisse continuer à s'écouler.

Pour les erreurs transitoires (coupure réseau, serveur en cours de démarrage), vous pouvez continuer à retenter
indéfiniment en définissant `forceRetry` sur l'erreur levée :

```typescript
import { OIBusError } from '../../shared/model/engine.model';

throw { ...new Error('Connection reset'), forceRetry: true } as OIBusError;
```

`forceRetry` maintient le fichier dans le cache indéfiniment — il n'est jamais déplacé vers le dossier d'erreurs.

## Connecteurs South {#south-connectors}

### Squelette minimal {#minimal-skeleton}

```typescript title="South skeleton — pick one or more capability interfaces"
import SouthConnector from '../south-connector';
import { SouthDirectQuery, SouthHistoryQuery, SouthSubscription } from '../south-interface';
import pino from 'pino';
import { DateTime } from 'luxon';
import { SouthMyTypeSettings, SouthMyTypeItemSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { Instant } from '../../model/types';

export default class SouthMyType extends SouthConnector<SouthMyTypeSettings, SouthMyTypeItemSettings> implements SouthDirectQuery {
  /* and/or SouthHistoryQuery, SouthSubscription */
  constructor(
    connector: SouthConnectorEntity<SouthMyTypeSettings, SouthMyTypeItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async connect(): Promise<void> {
    // open your transport here
    await super.connect();
  }

  override async disconnect(): Promise<void> {
    // close your transport here
    await super.disconnect();
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    // throw on failure; otherwise return any diagnostics
    return { items: [{ key: 'Status', value: 'OK' }] };
  }

  async testItem(
    item: SouthConnectorItemEntity<SouthMyTypeItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    // run a single item once and return the produced content
    return { type: 'time-values', content: [] };
  }

  // ─── If you implement SouthDirectQuery ────────────────────────────────────
  async directQuery(items: Array<SouthConnectorItemEntity<SouthMyTypeItemSettings>>): Promise<OIBusTimeValue | null> {
    const startTime = DateTime.now().toUTC().toISO()!;
    const values: Array<OIBusTimeValue> = [];
    // read each item, push to values…

    await this.addContent({ type: 'time-values', content: values }, startTime, items);
    return values.length ? values[values.length - 1] : null;
  }
}
```

### Méthodes obligatoires {#required-methods-1}

| Méthode                                                   | Objet                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `testConnection(): Promise<OIBusConnectionTestResult>`   | Sonde la source. Lève une exception en cas d'échec.                         |
| `testItem(item, testingSettings): Promise<OIBusContent>` | Exécute un item une fois pour le bouton « tester » de l'interface. Retourne le contenu produit. |

### Surcharges optionnelles {#optional-overrides-1}

Comme pour North : `connect()` et `disconnect()`. **Appelez toujours `super.*` à la fin** de votre surcharge afin
que l'état cron, la comptabilité des abonnements et l'événement `'connected'` restent synchronisés.

### Interfaces de capacité (South uniquement) {#capability-interfaces-south-only}

Un connecteur South implémente une ou plusieurs des trois interfaces de capacité définies dans `south-interface.ts`.
La classe de base les détecte via des vérifications structurelles `in` à l'exécution — vous n'avez pas besoin de
déclarer un indicateur.

#### `SouthDirectQuery` {#southdirectquery}

Pour les lectures ponctuelles — par ex. lecture de registre Modbus, appel d'API REST, « obtenir la valeur actuelle ».

```typescript
interface SouthDirectQuery {
  directQuery(items: Array<SouthConnectorItemEntity<...>>): Promise<unknown | null>;
}
```

La classe de base appelle `directQuery()` à chaque tick du mode de scan. Poussez les lectures réelles vers le
moteur via `this.addContent(...)` avant de retourner, et retournez la dernière valeur afin que l'interface puisse
l'afficher.

Exemple : `backend/src/south/south-modbus/south-modbus.ts`.

#### `SouthHistoryQuery` {#southhistoryquery}

Pour les lectures sur une fenêtre temporelle — par ex. OPC UA HistoryRead, `BETWEEN` en SQL, archive OSIsoft PI.

```typescript
interface SouthHistoryQuery {
  historyQuery(
    items: Array<SouthConnectorItemEntity<...>>,
    startTime: Instant,
    endTime: Instant,
    startTimeFromCache: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }>;
}
```

La classe de base planifie la fenêtre :

- `startTime` / `endTime` — la plage naturelle pour ce tick.
- `startTimeFromCache` — le début qui tient compte des données déjà récupérées. Utilisez-le pour construire la
  fenêtre de requête réelle afin qu'un redémarrage ne réinterroge pas l'historique. Le `startTime` est conservé
  séparément afin qu'une erreur survenue pendant un intervalle ne fasse pas perdre la trace du début de la plage
  d'origine.

Retournez l'horodatage de la valeur la plus récente récupérée sous `trackedInstant` ; la classe de base le persiste
afin que l'appel suivant reprenne à partir de là. Retournez `{ trackedInstant: null, value: null }` si rien n'a été
récupéré.

Exemple : `backend/src/south/south-opcua/south-opcua.ts`.

#### `SouthSubscription` {#southsubscription}

Pour les sources pilotées par événements — MQTT, abonnement OPC UA, tout ce qui est basé sur des événements.

```typescript
interface SouthSubscription {
  subscribe(items: Array<SouthConnectorItemEntity<...>>): Promise<void>;
  unsubscribe(items: Array<SouthConnectorItemEntity<...>>): Promise<void>;
}
```

La classe de base appelle `subscribe()` et `unsubscribe()` chaque fois que l'ensemble des items configurés diverge
de l'ensemble actuellement abonné. Lorsque des données arrivent, poussez-les via `this.addContent(...)` directement
depuis votre gestionnaire d'événements.

Les items d'abonnement sont identifiés par leur identifiant de mode de scan réservé `'subscription'`. Le
manifeste doit autoriser `'SUBSCRIPTION'` ou `'SUBSCRIPTION_AND_POLL'` sur le `scanMode` de l'item pour que
l'interface permette aux opérateurs de le sélectionner.

Exemples : `backend/src/south/south-mqtt/south-mqtt.ts` (abonnement uniquement),
`backend/src/south/south-opcua/south-opcua.ts` (les trois).

Une seule classe de connecteur peut implémenter n'importe quelle combinaison des trois interfaces ; la classe de
base répartit les appels de façon appropriée à chaque tick de scrutation.

### Envoi de données — `addContent` {#pushing-data--addcontent}

```typescript
await this.addContent(
  content, // OIBusContent (discriminated union by `type`)
  queryTime, // Instant — when this batch was fetched
  items // the items that produced it; used for metadata + transformer routing
);
```

`OIBusContent` est une union discriminée :

| `type`          | Forme de `content`                                                               | Utilisation                                     |
| --------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| `'time-values'` | `Array<OIBusTimeValue>` — `{ pointId, timestamp, data: { value, quality? } }` | La plupart des données de séries temporelles numériques / textuelles |
| `'any-content'` | `string` — une charge utile sérialisée opaque (par ex. messages MQTT sérialisés en JSON) | Lorsque la destination a besoin de la charge utile brute |
| `'any'`         | `{ filePath: string }` — un fichier déjà écrit sur le disque                       | Connecteurs basés sur des fichiers (scanner de dossier, FTP) |

Le moteur se charge d'écrire le contenu dans le cache de chaque North activé via son pipeline de transformateurs.
N'écrivez jamais directement dans le cache — passez toujours par `addContent`.

## Cycle de vie {#lifecycle}

```
start()              ← engine constructs and starts the connector
  ↓
connect()            ← open transport; install cron jobs
  ↓
◇ For each cron tick of an enabled item:
  ↓ run(scanMode, items)
  ├── directQueryHandler(items)         ← if SouthDirectQuery
  └── historyQueryHandler(items, …)     ← if SouthHistoryQuery
◇ For subscription items (South only):
  ↓ subscribe() / unsubscribe() reconciled when the item set changes
◇ For North:
  ↓ run(taskDescription) drains one file from the cache, calls handleContent()
  ↓ on success → archive / remove ; on failure → retry / error folder
  ↓
stop()               ← engine signals shutdown
  ↓
disconnect()         ← close transport
```

La classe de base pilote également les émetteurs d'événements `metricsEvent` et `'connected'`, et gère la
mécanique des promesses différées afin que `stop()` attende la fin propre de toute scrutation en cours. Surchargez
au bon niveau, appelez `super.*`, et le reste est automatique.

## Tests {#tests}

Les spécifications des connecteurs vivent à côté du fichier de la classe sous le nom `<connector-name>.spec.ts`.
La norme de l'équipe est une **couverture à 100 %** — y compris les chemins d'erreur, la gestion des nouvelles
tentatives, et `testConnection` / `testItem`. Les connecteurs existants fournissent de nombreux modèles de
référence ; choisissez-en un dont la combinaison d'interfaces correspond à la vôtre et suivez la structure de sa
spécification.
