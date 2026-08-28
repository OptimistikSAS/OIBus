---
sidebar_position: 0
---

# Paramètres communs

Un **connecteur South** récupère les données depuis une source spécifique (par exemple un broker MQTT, une base de
données MSSQL) et les transmet aux caches North. Chaque connecteur gère un ou plusieurs **éléments** — les points de
données ou requêtes individuels à collecter. Les éléments peuvent éventuellement être organisés en **groupes** pour
partager une planification et une configuration de limitation (throttling) communes.

## Ajouter un connecteur South {#adding-a-south-connector}

1. Accédez à la page **South**.
2. Cliquez sur le bouton **+**.
3. Sélectionnez un type de connecteur et configurez ses paramètres.
4. Surveillez ou ajustez les paramètres depuis la page d'affichage du connecteur.

## Paramètres généraux {#general-settings}

| Paramètre        | Description                                                                     | Exemple de valeur      |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------ |
| **Nom**           | Libellé convivial pour une identification facile.                                   | `My MSSQL Connector`     |
| **Description**   | Contexte optionnel (détails de connexion, droits d'accès, caractéristiques uniques). | `Production database`    |
| **Activé**        | Active/désactive le connecteur depuis la liste ou sa page d'affichage.              | Activé/Désactivé          |

## Section spécifique {#specific-section}

Reportez-vous à la documentation de chaque connecteur pour les paramètres spécifiques à son type.

### Test de connexion {#testing-connection}

Utilisez le bouton **Tester les paramètres** pour vérifier votre configuration de connexion.

---

## Groupes {#groups}

Un groupe regroupe des éléments qui partagent la même planification de collecte. Chaque groupe possède :

| Paramètre      | Description                                                                                       | Exemple de valeur |
| --------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| **Nom**         | Libellé unique pour le groupe au sein de ce connecteur.                                                | `Group A`             |
| **Mode de scan**| Planification utilisée pour collecter les données de tous les éléments du groupe.                      | `Every 1 min`         |
| **Limitation**  | _(connecteurs compatibles historique uniquement)_ Paramètres de limitation par défaut hérités par les éléments du groupe. | `3600, 200, 0` |

Les éléments assignés à un groupe héritent de son mode de scan. Pour les connecteurs compatibles historique, les
éléments héritent également par défaut des paramètres de limitation du groupe (intervalle de lecture maximum, délai
de lecture, décalage de l'heure de début, décalage de l'heure de fin, stratégie de récupération), mais chaque élément
peut les surcharger individuellement en désactivant **Synchroniser avec le groupe**.

Les éléments qui ne sont **assignés à aucun groupe** définissent leur propre mode de scan directement sur l'élément.

Les groupes ont également une importance au-delà de la planification : côté North, un transformateur peut être
assigné au niveau du groupe, de sorte que chaque élément du groupe soit transformé de la même façon sans configurer
chaque élément individuellement. Cela s'applique quel que soit le fait que le connecteur South soit compatible
historique ou non.

:::note Modèle d'exécution pour les connecteurs SQL et REST
Pour les connecteurs basés sur SQL et REST, les éléments au sein d'un même groupe sont tout de même récupérés **un à
un** de manière séquentielle. Le groupe fournit une planification partagée et des paramètres de limitation par
défaut, mais chaque élément exécute sa propre requête indépendante.
:::

### Actions sur les groupes {#group-actions}

Les groupes peuvent être créés, modifiés et supprimés directement depuis le formulaire d'édition d'élément ou depuis
le menu déroulant des groupes dans la liste des éléments. La suppression d'un groupe ne supprime pas ses éléments —
ils deviennent non assignés.

---

## Exécution concurrente {#concurrent-execution}

Par défaut, un connecteur South traite un élément (ou un groupe d'éléments) à la fois : même si plusieurs modes de
scan se déclenchent en même temps, une seule requête s'exécute à un instant donné, et les autres attendent leur tour.

Si un mode de scan se déclenche à nouveau alors que l'élément ou le groupe qu'il cible est encore en cours d'exécution
— ou déjà en attente — depuis un cycle précédent, cette nouvelle exécution est ignorée plutôt que de s'accumuler. Un
avertissement est journalisé lorsque cela se produit, limité à une fois par heure et par élément/groupe, afin qu'un
mode de scan configuré de manière trop agressive pour la charge de travail actuelle n'inonde pas les journaux tout en
vous informant que cela se produit.

Certains types de connecteurs peuvent exécuter en toute sécurité plus d'une requête à la fois, selon le comportement
de leur modèle de connexion sous-jacent, et exposent cela sous forme d'un paramètre **Nombre maximum de requêtes
parallèles** dans leur propre configuration — voir la documentation de ce connecteur (par exemple [OPC UA](./opcua.mdx#parallel-queries))
pour plus de détails. Pour tous les autres types de connecteurs, l'exécution reste entièrement séquentielle et n'est
pas configurable.

---

## Éléments {#items}

Les éléments récupèrent les données sous forme de fichiers ou de payloads JSON. Chaque élément possède les champs
suivants :

| Paramètre                       | Description                                                                                                                              | Exemple de valeur       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Nom**                          | Référence unique utilisée par les connecteurs North et les transformateurs pour identifier ce point de données.                          | `Temperature_Sensor1`      |
| **Groupe**                        | Le groupe auquel cet élément appartient. Laissez vide pour un élément autonome avec son propre mode de scan.                             | `Group A`                  |
| **Mode de scan**                  | Planification qui détermine quand OIBus collecte les données. Affiché uniquement lorsque l'élément n'a pas de groupe (sinon hérité du groupe). | `Every 1 min`         |
| **Activé**                        | Indique si l'élément est actif.                                                                                                           | Activé/Désactivé            |
| **Synchroniser avec le groupe**   | _(connecteurs compatibles historique uniquement)_ Lorsque activé, les paramètres de limitation sont hérités du groupe.                   | Activé/Désactivé            |
| **Intervalle de lecture maximum** | _(connecteurs compatibles historique)_ Durée maximale d'une sous-requête en secondes.                                                     | `3600`                     |
| **Délai de lecture**              | _(connecteurs compatibles historique)_ Pause en millisecondes entre les sous-requêtes consécutives.                                       | `200`                      |
| **Décalage de l'heure de début**  | _(connecteurs compatibles historique)_ Millisecondes ajoutées à `@StartTime`. Des valeurs négatives l'avancent pour capturer les données arrivées en retard. | `-60000`      |
| **Décalage de l'heure de fin**    | _(connecteurs compatibles historique)_ Millisecondes ajoutées à `@EndTime`. Des valeurs négatives l'avancent.                             | `0`                         |
| **Stratégie de récupération**     | _(connecteurs compatibles historique)_ Ordre dans lequel un arriéré de sous-intervalles non interrogés est rattrapé : du plus ancien au plus récent (par défaut) ou l'inverse. | `From oldest to newest` |
| **Paramètres spécifiques**        | Varie selon le type de connecteur — voir la documentation de chaque connecteur.                                                            | —                           |

> Pour des conseils sur le dimensionnement de **l'intervalle de lecture maximum**, du **délai de lecture**, du
> **décalage de l'heure de début** et du **décalage de l'heure de fin** — avec des exemples concrets pour de gros
> arriérés et des sources qui ne valident pas tous les éléments à la fois — voir
> [Ajuster les paramètres de temporisation des requêtes d'historique South](../advanced/history-query-timing.md).

### Actions sur les éléments {#item-actions}

- **Désactiver/Activer** : basculez depuis le formulaire d'édition de l'élément ou directement depuis la page
  d'affichage du connecteur.
- **Tester** : vérifiez les paramètres de l'élément et prévisualisez les résultats depuis la fenêtre modale de
  création/édition. Vous pouvez également faire passer le résultat brut par l'un des transformateurs North de
  l'élément pour prévisualiser la sortie transformée — voir
  [Tester un transformateur avec un élément South réel](../engine/transformers.mdx#testing-a-transformer-against-a-real-south-item).
  > **Astuce** : testez les paramètres de connexion avant de tester les éléments individuels.
- **Voir la dernière valeur** (🔍) : ouvre un panneau en lecture seule affichant l'état de la dernière récupération
  de l'élément. Voir [Inspecter la dernière valeur récupérée](#inspecting-the-last-retrieved-value) pour plus de
  détails.
- **Déplacer vers un groupe** : sélectionnez plusieurs éléments et utilisez le menu d'action groupée pour les
  réassigner à un groupe en une seule fois.

### Import/Export des éléments {#importexport-items}

- **Export** : téléchargez tous les éléments au format CSV. Les colonnes incluent `name`, `enabled`, `scanMode`,
  `group`, `syncWithGroup`, `maxReadInterval`, `readDelay`, `startTimeOffset`, `endTimeOffset`, `recoveryStrategy`, et
  les colonnes `settings_*` spécifiques au connecteur.
- **Import** : téléversez un CSV pour créer ou mettre à jour des éléments en masse. Exportez une liste existante pour
  obtenir un modèle valide avec les noms de colonnes corrects.
  > **Remarque** : le système vérifie les doublons et le bon formatage avant d'appliquer l'import.

---

## Suivi de l'instant maximum {#max-instant-tracking}

Les connecteurs South compatibles historique suivent le dernier horodatage récupéré avec succès (l'_instant
maximum_) afin que chaque exécution ne récupère que les nouvelles données. Le fait que cet instant soit suivi par
élément ou partagé au sein d'un groupe dépend de la façon dont le groupe est réellement interrogé :

- Si le connecteur peut regrouper les éléments d'un groupe en une seule requête (c'est-à-dire qu'il ne s'agit _pas_
  de l'un des connecteurs de type SQL/REST décrits ci-dessus, qui interrogent toujours un élément à la fois) **et**
  que l'élément a **Synchroniser avec le groupe** activé, l'ensemble du groupe partage **un seul** instant suivi —
  puisque le groupe est interrogé comme une seule unité, il n'y a pas de valeur par élément significative à suivre
  séparément.
- Sinon (pas de groupe, synchronisation désactivée, ou connecteur de type SQL/REST), chaque élément suit son propre
  instant indépendamment, même s'il appartient à un groupe.

:::tip Quitter un groupe partagé conserve l'instant suivi, pas la valeur en cache
Lorsqu'un élément cesse d'être adossé à un instant de groupe partagé — son groupe est réglé sur aucun,
**Synchroniser avec le groupe** est désactivé, ou le groupe lui-même est supprimé — il reprend l'_instant suivi_ du
groupe pour son propre suivi désormais indépendant, et reprend donc à partir de là au lieu de réinterroger toute une
fenêtre de rattrapage. La dernière _valeur_ en cache du groupe n'est **pas** reprise ; la propre valeur de l'élément
est simplement repeuplée lors de sa prochaine requête autonome. Passer directement d'un groupe synchronisé à un
autre ne déclenche pas ce comportement : l'élément continue de consulter un instant partagé tout du long, mais sous
le nouveau groupe.
:::

### Comportement lors des changements de configuration {#behaviour-when-configuration-changes}

| Action                              | Effet sur l'instant maximum                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changer le groupe de l'élément       | Un élément déjà indépendant conserve son propre instant suivi. Un élément quittant un groupe partagé reprend l'instant suivi de ce groupe pour son propre suivi (voir l'astuce ci-dessus). Passer entre deux groupes synchronisés continue d'utiliser un instant partagé tout du long. |
| Changer le mode de scan du groupe    | Le(s) instant(s) suivi(s) — par élément ou partagé — sont conservés sous le nouveau mode de scan.                                                                                                                                                        |
| Supprimer un groupe                  | Les éléments deviennent non assignés. Un élément qui était indépendant conserve son propre instant suivi ; un élément synchronisé avec le groupe reprend l'instant suivi partagé pour son propre suivi.                                                  |
| Supprimer un élément                 | Son propre instant suivi est supprimé ; un instant de groupe partagé n'est pas affecté tant que d'autres éléments restent dans le groupe.                                                                                                                |
| Supprimer le connecteur              | Tous les éléments, groupes et instants suivis sont supprimés.                                                                                                                                                                                             |

:::warning Écarts et doublons de données lors du changement des paramètres de limitation
Si vous modifiez l'intervalle de lecture maximum, le décalage de l'heure de début ou le décalage de l'heure de fin
d'un groupe ou d'un élément, la prochaine requête utilisera les nouveaux paramètres à partir de l'instant suivi
actuel. Un décalage significativement différent peut provoquer de petits écarts ou doublons à la frontière.
:::

### Inspecter la dernière valeur récupérée {#inspecting-the-last-retrieved-value}

Cliquez sur l'icône **🔍** sur n'importe quelle ligne d'élément pour ouvrir le panneau **Dernière valeur récupérée**.
Il affiche :

| Paramètre               | Description                                                                                                                                                                                                     | Exemple de valeur              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Nom de l'élément**      | Nom de l'élément.                                                                                                                                                                                                | `Temperature_Sensor1`             |
| **Groupe**                | Groupe auquel appartient cet élément, le cas échéant.                                                                                                                                                            | `Group A`                          |
| **Heure de la requête**   | Horodatage de la dernière exécution de la requête pour cet élément.                                                                                                                                              | `2024-01-15T10:30:00.000Z`        |
| **Instant suivi**         | L'_instant maximum_ stocké pour cet élément — utilisé comme `@StartTime` dans la prochaine requête. Vide si aucune requête n'a encore été exécutée.                                                             | `2024-01-15T10:29:55.000Z`        |
| **Valeur**                | Le dernier résultat en cache. Pour les connecteurs basés sur fichiers : une liste de noms de fichiers et d'heures de modification. Pour les connecteurs d'historique : le payload JSON brut de la dernière sous-requête. Vide si aucune donnée n'a encore été récupérée. | `[{"file": "data.csv", ...}]` |

Ce panneau est utile pour :

- Vérifier qu'un nouvel élément a commencé à collecter des données (vérifiez que **Instant suivi** est renseigné).
- Diagnostiquer des écarts de données — comparez l'instant suivi à l'heure actuelle pour voir le retard d'un
  élément.
- Confirmer le fichier ou l'enregistrement exact vu en dernier par les connecteurs basés sur fichiers.
