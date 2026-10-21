---
sidebar_position: 6
---

# Requêtes d'historique

Les requêtes d'historique vous permettent de récupérer des données sur une plage temporelle passée en utilisant la même
infrastructure de connecteurs South et North que le streaming en temps réel. Elles sont utiles pour combler rétroactivement
des données antérieures à l'activation de votre installation en direct, ou pour réexporter une période spécifique.

## Connecteurs South compatibles {#compatible-south-connectors}

Seuls les connecteurs South disposant de capacités d'historisation prennent en charge les requêtes d'historique :

| Connecteur                                              |
| ------------------------------------------------------- |
| [InfluxDB](./south-connectors/influxdb.mdx)             |
| [MongoDB](./south-connectors/mongodb.mdx)               |
| [MSSQL](./south-connectors/mssql.mdx)                   |
| [MySQL® / MariaDB™](./south-connectors/mysql.mdx)       |
| [ODBC](./south-connectors/odbc.mdx)                     |
| [OIAnalytics®](./south-connectors/oianalytics.mdx)      |
| [OLEDB](./south-connectors/oledb.mdx)                   |
| [OPC Classic™ (mode HDA)](./south-connectors/opc.mdx)   |
| [OPC UA™ (mode HA)](./south-connectors/opcua.mdx)       |
| [Oracle Database™](./south-connectors/oracle.mdx)       |
| [OSIsoft PI System™](./south-connectors/osisoft-pi.mdx) |
| [PostgreSQL](./south-connectors/postgresql.mdx)         |
| [REST](./south-connectors/rest.mdx)                     |
| [SQLite™](./south-connectors/sqlite.mdx)                |

## Créer une requête d'historique {#create-a-history-query}

Depuis la page **Historique**, cliquez sur **+**. Les côtés South et North sont configurés indépendamment, chacun
avec son propre commutateur (**À partir d'un South existant** / **À partir d'un North existant**) :

- **Désactivé** (par défaut) — choisissez un type de connecteur et configurez-le de zéro pour cette requête.
- **Activé** — choisissez un connecteur South ou North existant. Pour le côté South, tous ses éléments sont copiés
  dans la requête d'historique.

Toute combinaison est autorisée — par exemple, un tout nouveau connecteur South associé à un connecteur North existant.

Vous pouvez également **dupliquer** une requête d'historique existante depuis la liste des requêtes d'historique — cela copie
l'intégralité de la configuration South et North, les éléments et les transformateurs dans une nouvelle requête.

## Paramètres {#settings}

### Général {#general}

| Paramètre       | Description                                    | Exemple de valeur        |
| --------------- | ---------------------------------------------- | ------------------------ |
| **Nom**         | Étiquette unique pour la requête d'historique. | `Backfill Jan 2024`      |
| **Description** | Contexte facultatif pour la requête.           | `Re-export after outage` |

### Plage temporelle {#time-range}

| Paramètre                         | Description                                                                                                | Exemple de valeur          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Début**                         | Début de la période historique à récupérer.                                                                | `2024-01-01T00:00:00.000Z` |
| **Fin**                           | Fin de la période historique à récupérer.                                                                  | `2024-02-01T00:00:00.000Z` |
| **Intervalle de lecture maximal** | Durée maximale d'une sous-requête en secondes. La plage complète est découpée en morceaux de cette taille. | `3600`                     |
| **Délai de lecture**              | Pause en millisecondes entre des sous-requêtes consécutives, pour éviter de surcharger le système source.  | `200`                      |

> Pour des conseils sur le dimensionnement de l'**Intervalle de lecture maximal** et du **Délai de lecture** — y compris le
> compromis entre les deux sur un important arriéré — voir
> [Intervalle de lecture maximal](./advanced/history-query-timing.md#max-read-interval-bounding-how-much-a-single-query-asks-for)
> et [Délai de lecture](./advanced/history-query-timing.md#read-delay-pacing-consecutive-sub-queries) dans
> [Réglage avancé des connecteurs d'historique](./advanced/history-query-timing.md). Un élément de requête d'historique
> n'a ni groupe, ni décalages, ni stratégie de récupération, donc le reste de cette page ne s'applique pas ici.

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
mise en cache, transformateurs) est configuré exactement comme un connecteur North en direct. Les paramètres de connexion du côté South
sont configurés de la même manière également, mais les éléments sont simplifiés : un élément de requête d'historique n'a qu'un
**nom**, un indicateur **activé**, et ses paramètres spécifiques au type — il n'y a pas de mode de scan, de groupe, ni de
dérogation de limitation par élément. Chaque élément partage à la place les seuls paramètres de **Plage temporelle**
ci-dessus.

Les éléments se modifient dans la même fenêtre en trois étapes que les éléments South — **Paramètres** (avec le
panneau de test), **Nom** et **Vérification et enregistrement**, avec **Enregistrer et en ajouter un autre** pour une
série d'éléments — voir [Créer et modifier un élément](./south-connectors/common-settings.md#creating-and-editing-an-item).
Pour les connecteurs qui le permettent, **Explorer** parcourt la source de données, en lecture seule : les requêtes
d'historique n'ont ni **Ajouter comme points** ni synchronisation des points.

## Contrôles d'exécution {#execution-controls}

| Contrôle       | Description                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Démarrer**   | Disponible lorsque la requête est `PENDING`. Démarre la requête à partir de l'heure de début.                                                                                      |
| **Pause**      | Disponible lorsque la requête est `RUNNING`. Suspend l'exécution ; la progression de chaque élément est préservée.                                                                 |
| **Reprendre**  | Disponible lorsque la requête est `PAUSED`. Continue depuis la dernière position suivie de chaque élément.                                                                         |
| **Redémarrer** | Disponible lorsque la requête est `FINISHED` ou `ERRORED`. Réexécute la requête à partir de l'heure de début — démarrer dans cet état réinitialise toujours la progression suivie. |

Ces contrôles sont disponibles depuis la liste des requêtes d'historique et sa page d'affichage.

Modifier une requête d'historique existante vous invite également à réinitialiser le cache lors de l'enregistrement. Répondre **Oui**
efface toute la progression suivie afin que la prochaine exécution reparte de l'heure de début ; répondre **Non** conserve
la progression actuelle.

## Surveillance {#monitoring}

La page d'affichage montre des métriques en temps réel pour les côtés South et North de la requête. Ce que le côté
South rapporte dépend de la façon dont le connecteur exécute la requête — sur toute la plage en une fois, ou élément
par élément.

**Métriques South (récupération) — connecteurs par lots :**

La plupart des connecteurs interrogent toute la plage de leur élément/groupe en une seule fois, et rapportent la
progression sur l'ensemble de cette plage :

- Données récupérées — barre de progression globale de la requête
- Progression de l'intervalle — numéro d'intervalle actuel sur le total d'intervalles, avec sa fenêtre temporelle

**Métriques South (récupération) — connecteurs élément par élément :**

Les connecteurs basés sur SQL et REST (voir [Connecteurs South compatibles](#compatible-south-connectors))
interrogent leurs éléments un par un, la progression est donc rapportée par élément plutôt que pour l'ensemble de
la plage :

- Éléments traités — nom de l'élément en cours d'interrogation, et sa position (`actuel / total`) parmi tous les
  éléments, avec une barre de progression
- Progression de l'élément courant — la propre progression du sous-intervalle de l'élément courant, avec sa fenêtre
  temporelle
- Un tableau **Statut des éléments** sous les métriques, listant chaque élément avec son statut (`En attente`,
  `En cours` ou `Terminé`), la dernière valeur récupérée, et le nombre d'enregistrements récupérés jusqu'ici

:::tip Suivre la progression depuis la page de liste
La page de liste des requêtes d'historique affiche également un indicateur de progression `(actuel / total)` par
élément à côté de l'icône de statut d'une requête en cours d'exécution, sans avoir à ouvrir sa page d'affichage.
:::

**Métriques South (récupération) — communes aux deux :**

- Valeurs/fichiers par seconde et temps restant estimé, pendant que la requête s'exécute
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

Chaque élément (ou groupe synchronisé) suit son propre dernier horodatage récupéré de manière indépendante, de sorte que la requête peut reprendre
après un échec ou un redémarrage sans re-récupérer des données déjà récupérées. La progression est préservée entre les redémarrages
d'OIBus.

:::caution Réinitialisation de la progression
Réinitialiser le cache efface la progression suivie de chaque élément. La prochaine exécution repartira du
**Début** d'origine, ce qui peut entraîner l'envoi de données en double au connecteur North.
:::
