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

| Paramètre       | Description                                                                          | Exemple de valeur     |
| --------------- | ------------------------------------------------------------------------------------ | --------------------- |
| **Nom**         | Libellé convivial pour une identification facile.                                    | `My MSSQL Connector`  |
| **Description** | Contexte optionnel (détails de connexion, droits d'accès, caractéristiques uniques). | `Production database` |
| **Activé**      | Active/désactive le connecteur depuis la liste ou sa page d'affichage.               | Activé/Désactivé      |

## Section spécifique {#specific-section}

Reportez-vous à la documentation de chaque connecteur pour les paramètres spécifiques à son type.

### Test de connexion {#testing-connection}

Utilisez le bouton **Tester les paramètres** pour vérifier votre configuration de connexion.

---

## Groupes {#groups}

Un groupe regroupe des éléments qui partagent la même planification de collecte. Chaque groupe possède :

| Paramètre                      | Description                                                                                                                                                                                    | Exemple de valeur |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Nom**                        | Libellé unique pour le groupe au sein de ce connecteur.                                                                                                                                        | `Group A`         |
| **Mode de scan**               | Planification utilisée pour collecter les données de tous les éléments du groupe.                                                                                                              | `Every 1 min`     |
| **Limitation**                 | _(connecteurs compatibles historique uniquement)_ Paramètres de limitation par défaut hérités par les éléments du groupe.                                                                      | `3600, 200, 0`    |
| **Stratégie de mise en cache** | _(connecteurs de la famille IoT uniquement)_ Stratégie de mise en cache par défaut héritée par les éléments synchronisés avec le groupe. Voir [Stratégie de mise en cache](#caching-strategy). | `On change`       |

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

| Paramètre                         | Description                                                                                                                                                                                                 | Exemple de valeur       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Nom**                           | Référence unique utilisée par les connecteurs North et les transformateurs pour identifier ce point de données.                                                                                             | `Temperature_Sensor1`   |
| **Groupe**                        | Le groupe auquel cet élément appartient. Laissez vide pour un élément autonome avec son propre mode de scan.                                                                                                | `Group A`               |
| **Mode de scan**                  | Planification qui détermine quand OIBus collecte les données. Affiché uniquement lorsque l'élément n'a pas de groupe (sinon hérité du groupe).                                                              | `Every 1 min`           |
| **Activé**                        | Indique si l'élément est actif.                                                                                                                                                                             | Activé/Désactivé        |
| **Synchroniser avec le groupe**   | _(connecteurs compatibles historique uniquement)_ Lorsque activé, les paramètres de limitation sont hérités du groupe.                                                                                      | Activé/Désactivé        |
| **Intervalle de lecture maximum** | _(connecteurs compatibles historique)_ Durée maximale d'une sous-requête en secondes.                                                                                                                       | `3600`                  |
| **Délai de lecture**              | _(connecteurs compatibles historique)_ Pause en millisecondes entre les sous-requêtes consécutives.                                                                                                         | `200`                   |
| **Décalage de l'heure de début**  | _(connecteurs compatibles historique)_ Millisecondes ajoutées à `@StartTime`. Des valeurs négatives l'avancent pour capturer les données arrivées en retard.                                                | `-60000`                |
| **Décalage de l'heure de fin**    | _(connecteurs compatibles historique)_ Millisecondes ajoutées à `@EndTime`. Des valeurs négatives l'avancent.                                                                                               | `0`                     |
| **Stratégie de récupération**     | _(connecteurs compatibles historique)_ Ordre dans lequel un arriéré de sous-intervalles non interrogés est rattrapé : du plus ancien au plus récent (par défaut) ou l'inverse.                              | `From oldest to newest` |
| **Stratégie de mise en cache**    | _(connecteurs de la famille IoT uniquement)_ Filtre les valeurs collectées qui sont effectivement mises en cache et transmises aux connecteurs North. Voir [Stratégie de mise en cache](#caching-strategy). | `On change`             |
| **Paramètres spécifiques**        | Varie selon le type de connecteur — voir la documentation de chaque connecteur.                                                                                                                             | —                       |

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

## Stratégie de mise en cache {#caching-strategy}

Pour les **connecteurs de la famille IoT** (OPC UA, Modbus, ADS, OPC Classic, S7, MQTT), chaque élément peut filtrer
les valeurs collectées qui sont effectivement mises en cache et transmises aux connecteurs North, au lieu de mettre
en cache chaque valeur lue ou reçue. Cela réduit la taille du cache et la charge sur le connecteur North pour les
points stables ou qui évoluent lentement.

| Paramètre                               | Description                                                                                                                                                                                                                                                                                                                                                                                                                     | Exemple de valeur |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Stratégie de mise en cache**          | `All values` (par défaut) : met en cache chaque valeur. `On change` : ne met en cache que lorsque la valeur diffère de la dernière valeur mise en cache. `Threshold` : ne met en cache que lorsque la valeur varie de plus d'un montant configuré. Lorsqu'elle n'est pas définie sur un élément synchronisé avec un groupe, l'élément hérite de la stratégie de mise en cache du groupe.                                        | `On change`       |
| **Type de seuil**                       | _(stratégie Threshold uniquement)_ `Absolute` : compare la différence numérique brute. `Percentage` : compare la différence sous forme de pourcentage d'une plage configurée.                                                                                                                                                                                                                                                   | `Percentage`      |
| **Seuil**                               | _(stratégie Threshold uniquement)_ Le changement minimal requis pour mettre en cache une nouvelle valeur — interprété comme une différence absolue ou un pourcentage de la plage, selon le **Type de seuil**.                                                                                                                                                                                                                   | `5`               |
| **Plage basse** / **Plage haute**       | _(stratégie Threshold, type pourcentage uniquement)_ La borne inférieure/supérieure attendue de la valeur, utilisée pour calculer l'étendue en pourcentage par rapport à laquelle le seuil est mesuré.                                                                                                                                                                                                                          | `0` / `100`       |
| **Intervalle de mise en cache maximum** | _(non affiché pour « All values »)_ Signal de vie (heartbeat) optionnel, en millisecondes. Même si une valeur ne remplit pas les conditions de **On change** ou **Threshold**, elle est tout de même mise en cache une fois ce délai écoulé depuis la dernière valeur mise en cache — de sorte qu'un point stable produit tout de même des données périodiques prouvant qu'il est toujours actif. Laisser vide pour désactiver. | `3600000`         |

Contrairement aux paramètres de planification, le **Type de seuil**, le **Seuil**, la **Plage basse**/**Plage
haute**, et l'**Intervalle de mise en cache maximum** sont toujours configurés sur l'élément lui-même — ils ne sont
jamais hérités d'un groupe, même lorsque la **Stratégie de mise en cache** de l'élément l'est.

:::note Non disponible pour tous les connecteurs
La stratégie **Threshold** n'est pas proposée pour les éléments MQTT, car les payloads MQTT ne sont pas garantis
d'être numériques. **On change** compare les valeurs par égalité profonde à la place, ce qui fonctionne pour
n'importe quelle forme de payload.
:::

:::tip La première valeur est toujours mise en cache
La première valeur collectée pour un élément — ou la première collectée à nouveau après la disparition de son état
de comparaison en cache (par exemple, l'élément a été supprimé puis recréé) — est toujours mise en cache, puisqu'il
n'y a encore rien avec quoi la comparer. Cet état de comparaison est persisté, il survit donc aux redémarrages
d'OIBus au lieu d'être réinitialisé à chaque reconnexion.
:::

Les groupes peuvent également se voir attribuer une **Stratégie de mise en cache**, que les éléments synchronisés
avec le groupe utilisent par défaut. Les champs spécifiques au seuil, en revanche, ne sont jamais hérités : si la
stratégie de mise en cache d'un groupe est **Threshold**, chaque élément synchronisé doit tout de même configurer
son propre **Type de seuil**/**Seuil**/**Plage** — les laisser non définis revient à un seuil absolu de `0` (c'est-à-dire
que tout changement est mis en cache).

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

| Action                            | Effet sur l'instant maximum                                                                                                                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changer le groupe de l'élément    | Un élément déjà indépendant conserve son propre instant suivi. Un élément quittant un groupe partagé reprend l'instant suivi de ce groupe pour son propre suivi (voir l'astuce ci-dessus). Passer entre deux groupes synchronisés continue d'utiliser un instant partagé tout du long. |
| Changer le mode de scan du groupe | Le(s) instant(s) suivi(s) — par élément ou partagé — sont conservés sous le nouveau mode de scan.                                                                                                                                                                                      |
| Supprimer un groupe               | Les éléments deviennent non assignés. Un élément qui était indépendant conserve son propre instant suivi ; un élément synchronisé avec le groupe reprend l'instant suivi partagé pour son propre suivi.                                                                                |
| Supprimer un élément              | Son propre instant suivi est supprimé ; un instant de groupe partagé n'est pas affecté tant que d'autres éléments restent dans le groupe.                                                                                                                                              |
| Supprimer le connecteur           | Tous les éléments, groupes et instants suivis sont supprimés.                                                                                                                                                                                                                          |

:::warning Écarts et doublons de données lors du changement des paramètres de limitation
Si vous modifiez l'intervalle de lecture maximum, le décalage de l'heure de début ou le décalage de l'heure de fin
d'un groupe ou d'un élément, la prochaine requête utilisera les nouveaux paramètres à partir de l'instant suivi
actuel. Un décalage significativement différent peut provoquer de petits écarts ou doublons à la frontière.
:::

### Inspecter la dernière valeur récupérée {#inspecting-the-last-retrieved-value}

Cliquez sur l'icône **🔍** sur n'importe quelle ligne d'élément pour ouvrir le panneau **Dernière valeur récupérée**.
Il affiche :

| Paramètre               | Description                                                                                                                                                                                                                                                              | Exemple de valeur             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **Nom de l'élément**    | Nom de l'élément.                                                                                                                                                                                                                                                        | `Temperature_Sensor1`         |
| **Groupe**              | Groupe auquel appartient cet élément, le cas échéant.                                                                                                                                                                                                                    | `Group A`                     |
| **Heure de la requête** | Horodatage de la dernière exécution de la requête pour cet élément.                                                                                                                                                                                                      | `2024-01-15T10:30:00.000Z`    |
| **Instant suivi**       | L'_instant maximum_ stocké pour cet élément — utilisé comme `@StartTime` dans la prochaine requête. Vide si aucune requête n'a encore été exécutée.                                                                                                                      | `2024-01-15T10:29:55.000Z`    |
| **Valeur**              | Le dernier résultat en cache. Pour les connecteurs basés sur fichiers : une liste de noms de fichiers et d'heures de modification. Pour les connecteurs d'historique : le payload JSON brut de la dernière sous-requête. Vide si aucune donnée n'a encore été récupérée. | `[{"file": "data.csv", ...}]` |

Ce panneau est utile pour :

- Vérifier qu'un nouvel élément a commencé à collecter des données (vérifiez que **Instant suivi** est renseigné).
- Diagnostiquer des écarts de données — comparez l'instant suivi à l'heure actuelle pour voir le retard d'un
  élément.
- Confirmer le fichier ou l'enregistrement exact vu en dernier par les connecteurs basés sur fichiers.
