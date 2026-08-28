---
sidebar_position: 6
---

# Requêtes d'historique

Les requêtes d'historique vous permettent de récupérer des données sur une plage temporelle passée en utilisant la même
infrastructure de connecteurs South et North que le streaming en temps réel. Elles sont utiles pour combler rétroactivement
des données antérieures à l'activation de votre installation en direct, ou pour réexporter une période spécifique.

## Connecteurs South compatibles {#compatible-south-connectors}

Seuls les connecteurs South disposant de capacités d'historisation prennent en charge les requêtes d'historique :

| Connecteur                                               |
| --------------------------------------------------------- |
| [InfluxDB](./south-connectors/influxdb.mdx)                |
| [MSSQL](./south-connectors/mssql.mdx)                       |
| [MySQL® / MariaDB™](./south-connectors/mysql.mdx)          |
| [ODBC](./south-connectors/odbc.mdx)                         |
| [OIAnalytics®](./south-connectors/oianalytics.mdx)          |
| [OLEDB](./south-connectors/oledb.mdx)                       |
| [OPC Classic™ (mode HDA)](./south-connectors/opc.mdx)      |
| [OPC UA™ (mode HA)](./south-connectors/opcua.mdx)          |
| [Oracle Database™](./south-connectors/oracle.mdx)          |
| [OSIsoft PI System™](./south-connectors/osisoft-pi.mdx)    |
| [PostgreSQL](./south-connectors/postgresql.mdx)             |
| [REST](./south-connectors/rest.mdx)                         |
| [SQLite™](./south-connectors/sqlite.mdx)                    |

## Créer une requête d'historique {#create-a-history-query}

Depuis la page **History**, cliquez sur **+**. Les côtés South et North sont configurés indépendamment, chacun avec
son propre commutateur **From existing connector** :

- **Désactivé** (par défaut) — choisissez un type de connecteur et configurez-le de zéro pour cette requête.
- **Activé** — choisissez un connecteur South ou North existant. Pour le côté South, tous ses items sont copiés
  dans la requête d'historique.

Toute combinaison est autorisée — par exemple, un tout nouveau connecteur South associé à un connecteur North existant.

Vous pouvez également **dupliquer** une requête d'historique existante depuis la liste des requêtes d'historique — cela copie
l'intégralité de la configuration South et North, les items, et les transformers dans une nouvelle requête.

## Paramètres {#settings}

### Général {#general}

| Paramètre         | Description                            | Exemple de valeur         |
| ------------------ | ---------------------------------------- | ---------------------------- |
| **Name**          | Étiquette unique pour la requête d'historique. | `Backfill Jan 2024`          |
| **Description**   | Contexte facultatif pour la requête.     | `Re-export after outage`     |

### Plage temporelle {#time-range}

| Paramètre               | Description                                                                                       | Exemple de valeur              |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Start time**            | Début de la période historique à récupérer.                                                          | `2024-01-01T00:00:00.000Z`         |
| **End time**              | Fin de la période historique à récupérer.                                                            | `2024-02-01T00:00:00.000Z`         |
| **Max read interval**     | Durée maximale d'une sous-requête en secondes. La plage complète est découpée en morceaux de cette taille. | `3600`                             |
| **Read delay**            | Pause en millisecondes entre des sous-requêtes consécutives, pour éviter de surcharger le système source. | `200`                              |

> Pour des conseils sur le dimensionnement de **Max read interval** et **Read delay** — y compris le compromis entre les deux sur un
> important arriéré — voir [Max read interval](./advanced/history-query-timing.md#max-read-interval-bounding-how-much-a-single-query-asks-for)
> et [Read delay](./advanced/history-query-timing.md#read-delay-pacing-consecutive-sub-queries) dans
> [Réglage des paramètres d'appel d'historique South](./advanced/history-query-timing.md). Un item de requête d'historique n'a ni groupe,
> ni décalages, ni stratégie de récupération, donc le reste de cette page ne s'applique pas ici.

:::caution Connecteurs SQL
Pour les connecteurs basés sur SQL, votre requête **doit** inclure les deux variables temporelles :

```sql
SELECT * FROM sensor_data
WHERE timestamp > @StartTime
AND timestamp <= @EndTime
```

:::

### Configuration South et North {#south-and-north-configuration}

Une requête d'historique intègre un connecteur South complet et un connecteur North complet. Le côté North (paramètres,
mise en cache, transformers) est configuré exactement comme un connecteur North en direct. Les paramètres de connexion du côté South
sont configurés de la même manière également, mais les items sont simplifiés : un item de requête d'historique n'a qu'un
**nom**, un indicateur **activé**, et ses paramètres spécifiques au type — il n'y a pas de mode de scan, de groupe, ni de
dérogation de limitation par item. Chaque item partage les seuls paramètres de **Plage temporelle** ci-dessus.

## Contrôles d'exécution {#execution-controls}

| Contrôle    | Description                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Start**   | Disponible lorsque la requête est `PENDING`. Démarre la requête à partir de Start time.                                                              |
| **Pause**   | Disponible lorsque la requête est `RUNNING`. Suspend l'exécution ; la progression de chaque item est préservée.                                       |
| **Resume**  | Disponible lorsque la requête est `PAUSED`. Continue depuis la dernière position suivie de chaque item.                                               |
| **Restart** | Disponible lorsque la requête est `FINISHED` ou `ERRORED`. Réexécute la requête à partir de Start time — démarrer dans cet état réinitialise toujours la progression suivie. |

Ces contrôles sont disponibles depuis la liste des requêtes d'historique et sa page d'affichage.

Modifier une requête d'historique existante vous invite également à réinitialiser le cache lors de l'enregistrement. Répondre **Yes**
efface toute la progression suivie afin que la prochaine exécution reparte de Start time ; répondre **No** conserve la progression actuelle.

## Surveillance {#monitoring}

La page d'affichage montre des métriques en temps réel pour les côtés South et North de la requête :

**Métriques South (récupération) :**

- Progression de l'intervalle — numéro d'intervalle actuel sur le total d'intervalles
- Nombre de valeurs et de fichiers récupérés
- Heure de dernière connexion
- Dernière valeur récupérée (identifiant de point, horodatage, donnée)
- Dernier fichier récupéré
- Heure de démarrage et durée de la dernière exécution

**Métriques North (transmission) :**

- Taille du cache — actuelle, total mis en cache, total envoyé
- Taille des erreurs — actuelle, total en erreur
- Taille de l'archive — actuelle, total archivé
- Heure de dernière connexion
- Dernier contenu envoyé
- Heure de démarrage et durée de la dernière exécution

## Récupération automatique {#automatic-recovery}

Chaque item (ou groupe synchronisé) suit son propre dernier horodatage récupéré de manière indépendante, de sorte que la requête peut reprendre
après un échec ou un redémarrage sans re-récupérer des données déjà récupérées. La progression est préservée entre les redémarrages
d'OIBus.

:::caution Réinitialisation de la progression
Réinitialiser le cache efface la progression suivie de chaque item. La prochaine exécution repartira du
**Start time** d'origine, ce qui peut entraîner l'envoi de données en double au connecteur North.
:::
