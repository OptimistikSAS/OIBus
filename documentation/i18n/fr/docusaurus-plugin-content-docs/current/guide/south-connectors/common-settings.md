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

Un élément lit un point de données, une requête ou un ensemble de fichiers depuis la source de données. Les éléments
sont listés sur la page du connecteur, où ils peuvent être créés, modifiés, copiés, activés/désactivés, supprimés,
déplacés vers un groupe, importés et exportés. Plutôt que de les créer un par un, les éléments peuvent aussi être
[ajoutés depuis la fenêtre d'exploration](#exploring-the-data-source) ou tenus à jour par une
[synchronisation des points](#items-synchronisation).

### Créer et modifier un élément {#creating-and-editing-an-item}

La fenêtre de l'élément se parcourt en trois étapes, affichées dans une barre d'étapes en haut de la fenêtre. Les
paramètres viennent en premier, pour être testés avant de nommer et de planifier l'élément :

| Étape                              | Contenu                                                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paramètres**                     | Les paramètres d'élément propres au connecteur (voir la page de chaque connecteur), avec le [panneau de test](#testing-an-item) juste en dessous, pour essayer les paramètres au fil de leur modification. |
| **Nom et planification**           | Nom, groupe, planification et **Activé**, puis les **Paramètres d'historique** (connecteurs compatibles historique) et les paramètres de **Mise en cache** (connecteurs de la famille IoT).                |
| **Vérification et enregistrement** | Un récapitulatif en lecture seule de l'élément complet : paramètres généraux, d'historique et de mise en cache, puis ses paramètres de connecteur.                                                         |

**Suivant** ne passe à l'étape suivante qu'une fois l'étape courante valide. Un nouvel élément s'enregistre depuis la
dernière étape ; un élément en cours de modification ou de copie peut être enregistré depuis n'importe quelle étape.
Lorsqu'un enregistrement échoue sur un champ invalide, la fenêtre ouvre la première étape en erreur, et chaque étape
en erreur est signalée dans la barre d'étapes.

Pour créer plusieurs éléments similaires à la suite, utilisez **Enregistrer et en ajouter un autre** (**OK et en
ajouter un autre** sur la page de création/modification du connecteur) : l'élément est enregistré, et la fenêtre se
rouvre pour le suivant, avec le même groupe, la même planification et les mêmes paramètres d'historique.

Sur la page de création/modification du connecteur, les éléments (comme les groupes et les synchronisations des
points) sont conservés dans la page et enregistrés avec le connecteur, d'où le bouton **OK** au lieu de
**Enregistrer**.

### Champs d'un élément {#item-fields}

| Paramètre                         | Étape                | Description                                                                                                                                                                           | Exemple de valeur               |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Nom**                           | Nom et planification | Référence unique utilisée par les connecteurs North et les transformateurs pour identifier ce point de données.                                                                       | `Temperature_Sensor1`           |
| **Groupe**                        | Nom et planification | Le groupe auquel cet élément appartient. Laissez sur **Aucun** pour un élément autonome avec sa propre planification.                                                                 | `Group A`                       |
| **Planification**                 | Nom et planification | Mode de scan qui détermine quand OIBus collecte les données. Affiché uniquement lorsque l'élément n'a pas de groupe (la planification du groupe est affichée sinon).                  | `Every 1 min`                   |
| **Activé**                        | Nom et planification | Indique si l'élément est actif.                                                                                                                                                       | Activé/Désactivé                |
| **Synchroniser avec le groupe**   | Nom et planification | _(connecteurs compatibles historique, éléments groupés)_ Lorsque activé, les paramètres d'historique ci-dessous sont hérités du groupe.                                               | Activé/Désactivé                |
| **Intervalle de lecture maximal** | Nom et planification | _(connecteurs compatibles historique)_ Durée maximale d'une sous-requête en secondes.                                                                                                 | `3600`                          |
| **Délai de lecture**              | Nom et planification | _(connecteurs compatibles historique)_ Pause en millisecondes entre les sous-requêtes consécutives.                                                                                   | `200`                           |
| **Décalage de l'heure de début**  | Nom et planification | _(connecteurs compatibles historique)_ Millisecondes ajoutées à `@StartTime`. Des valeurs négatives l'avancent pour capturer les données arrivées en retard.                          | `-60000`                        |
| **Décalage de l'heure de fin**    | Nom et planification | _(connecteurs compatibles historique)_ Millisecondes ajoutées à `@EndTime`. Des valeurs négatives l'avancent.                                                                         | `0`                             |
| **Stratégie de récupération**     | Nom et planification | _(connecteurs compatibles historique)_ Ordre dans lequel un arriéré de sous-intervalles non interrogés est rattrapé : du plus ancien au plus récent (par défaut) ou l'inverse.        | `Du plus ancien au plus récent` |
| **Stratégie de mise en cache**    | Nom et planification | _(connecteurs de la famille IoT uniquement)_ Filtre les valeurs collectées qui sont effectivement mises en cache et transmises. Voir [Stratégie de mise en cache](#caching-strategy). | `On change`                     |
| **Paramètres spécifiques**        | Paramètres           | Varie selon le type de connecteur — voir la documentation de chaque connecteur.                                                                                                       | —                               |

> Pour des conseils sur le dimensionnement de **l'intervalle de lecture maximal**, du **délai de lecture**, du
> **décalage de l'heure de début** et du **décalage de l'heure de fin** — avec des exemples concrets pour de gros
> arriérés et des sources qui ne valident pas tous les éléments à la fois — voir
> [Ajuster les paramètres de temporisation des requêtes d'historique South](../advanced/history-query-timing.md).

### Tester un élément {#testing-an-item}

L'étape **Paramètres** contient le panneau de test, de sorte que les paramètres de l'élément peuvent être modifiés et
testés à nouveau sans quitter l'étape. **Lancer le test** interroge la source de données avec les paramètres tels
qu'ils sont en cours de modification — enregistrés ou non — et affiche le résultat brut. Pour les connecteurs
compatibles historique, **Interroger les données depuis** / **Interroger les données jusqu'à** définissent la plage
temporelle de la requête de test.

Le résultat brut peut aussi passer par l'un des transformateurs North de l'élément, pour prévisualiser la sortie
transformée — voir
[Tester un transformateur sur un élément South réel](../engine/transformers.mdx#testing-a-transformer-against-a-real-south-item).

> **Astuce** : utilisez d'abord **Tester les paramètres** sur le connecteur, pour vérifier la connexion avant de
> tester les éléments individuels.

### Actions sur les éléments {#item-actions}

- **Désactiver/Activer** : basculez depuis la fenêtre de l'élément ou directement depuis la page d'affichage du
  connecteur. Plusieurs éléments sélectionnés peuvent être activés ou désactivés en une seule fois.
- **Copier** : ouvre la fenêtre de l'élément pré-remplie avec les paramètres de l'élément, pour créer un élément
  similaire.
- **Voir la dernière valeur** (🔍) : ouvre un panneau en lecture seule affichant l'état de la dernière récupération
  de l'élément. Voir [Inspecter la dernière valeur récupérée](#inspecting-the-last-retrieved-value) pour plus de
  détails.
- **Déplacer vers le groupe** : sélectionnez plusieurs éléments et utilisez le menu d'actions groupées pour les
  réassigner à un groupe en une seule fois.

### Import/Export des éléments {#importexport-items}

- **Exporter** : téléchargez tous les éléments au format CSV. Les colonnes incluent `name`, `enabled`, `scanMode`,
  `group`, `syncWithGroup`, `maxReadInterval`, `readDelay`, `startTimeOffset`, `endTimeOffset`, `recoveryStrategy`, et
  les colonnes `settings_*` spécifiques au connecteur.
- **Importer** : téléversez un CSV pour créer ou mettre à jour des éléments en masse. Exportez une liste existante
  pour obtenir un modèle valide avec les noms de colonnes corrects.
  > **Remarque** : le système vérifie les doublons et le bon formatage avant d'appliquer l'import.

---

## Explorer la source de données {#exploring-the-data-source}

Les connecteurs capables de parcourir leur source de données affichent un bouton **Explorer** à côté de **Tester les
paramètres**. Il ouvre la fenêtre **Explorer la source de données** : une arborescence de ce que contient la source de
données, chargée niveau par niveau au fil du dépliage des nœuds.

| Connecteur                                                | Ce que montre l'arborescence                                                                                 | Actions sur les nœuds sélectionnés          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| [OPC UA](./opcua.mdx#node-metadata)                       | L'espace d'adressage du serveur, avec les métadonnées des nœuds (ID du nœud, type, description, unité…)      | **Ajouter comme points**, **Synchroniser…** |
| [BACnet/IP](./bacnet.mdx#discovering-devices-and-objects) | Les appareils, puis les objets de chaque appareil                                                            | **Ajouter comme points**, **Synchroniser…** |
| MSSQL, MySQL, PostgreSQL, Oracle, SQLite                  | Les tables (avec leur nombre de colonnes et de lignes lorsque disponible), puis les colonnes de chaque table | **Ajouter comme points**                    |
| [Folder Scanner](./folder-scanner.mdx)                    | Les dossiers et fichiers du dossier d'entrée, avec leur taille et leurs dates                                | — (navigation uniquement)                   |

Cliquez sur un nœud pour afficher ses détails (les métadonnées que la source de données fournit pour lui) dans un
panneau latéral, chaque valeur avec un bouton de copie. L'exploration utilise les paramètres tels qu'ils sont en cours
de modification, elle fonctionne donc depuis la page de création/modification du connecteur avant que celui-ci ne
soit enregistré.

:::tip L'exploration et la connexion propre au connecteur
Un connecteur en cours d'exécution avec les mêmes paramètres est exploré via sa connexion ouverte, plutôt qu'une
seconde — les serveurs qui limitent le nombre de sessions par client (par ex. OPC UA) ne la refusent pas. Un
connecteur désactivé ou non enregistré est exploré via une instance temporaire, libérée à la fermeture de la fenêtre,
de sorte que l'exploration ne démarre jamais la collecte propre au connecteur.
:::

### Sélectionner des nœuds {#selecting-nodes}

Pour les connecteurs proposant des actions sur les nœuds sélectionnés, chaque nœud possède une case à cocher. Un nœud
qui a des enfants propose aussi **Sélectionner tous les sous-nœuds**, qui charge et coche ses enfants directs en une
fois (et les décoche lorsqu'ils sont déjà tous cochés). Le nombre de nœuds sélectionnés est affiché en bas de la
fenêtre, à côté des actions :

- **Ajouter comme points** crée des éléments une fois à partir des nœuds sélectionnés — voir
  [ci-dessous](#adding-explored-nodes-as-items).
- **Synchroniser…** crée une [synchronisation des points](#items-synchronisation) qui découvre à partir des nœuds
  sélectionnés : l'assistant s'ouvre avec ces nœuds comme périmètre de découverte, et les
  [valeurs par défaut de découverte](#discovery-defaults) du connecteur. Contrairement à **Ajouter comme points**, la
  synchronisation tient les éléments à jour à chaque exécution : les nouveaux points obtiennent un élément, et les
  éléments des points disparus sont désactivés.

Ce que représente un nœud sélectionné dépend de sa nature : un point (une variable OPC UA, un objet BACnet, une
colonne SQL) vaut pour lui-même, tout autre nœud (un dossier, un appareil, une table) pour tout ce qu'il contient.

### Ajouter des nœuds explorés comme éléments {#adding-explored-nodes-as-items}

**Ajouter comme points** découvre les points sous les nœuds sélectionnés et ouvre la fenêtre **Ajouter des points
depuis la source de données**, pour vérifier les éléments avant leur création :

- **Groupe**, **Planification** et **Activer les points** s'appliquent à chaque élément ajouté. Avec un groupe, les
  éléments prennent la planification du groupe.
- Chaque ligne est un élément, avec son nom (modifiable) et ses principaux paramètres. Décochez une ligne pour
  l'écarter, ou utilisez la case à cocher de l'en-tête pour tout sélectionner ou rien.
- Une ligne dont les paramètres sont déjà lus par un élément existant est signalée **Déjà lu par** _cet élément_, et
  laissée décochée. Un nom déjà utilisé par un autre élément ou une autre ligne est signalé **Nom déjà utilisé**.

**Ajouter les points** crée les lignes cochées. Les éléments sont nommés et configurés à partir des
[valeurs par défaut de découverte](#discovery-defaults) du connecteur ; chaque paramètre d'élément qu'elles ne
couvrent pas reçoit sa valeur par défaut habituelle, comme dans la fenêtre de l'élément.

#### Tables SQL comme éléments {#sql-tables-as-items}

Pour les connecteurs SQL, chaque table sélectionnée (ou chaque table à laquelle appartiennent des colonnes
sélectionnées) donne un élément, nommé d'après la table, dont la requête lit la table :

- Une table sélectionnée lit toutes ses colonnes (`SELECT *`) ; des colonnes sélectionnées ne lisent que ces
  colonnes.
- OIBus choisit une **colonne date/heure** pour suivre la table : parmi les colonnes date/heure de la table, il
  privilégie un nom usuel (`timestamp`, `time`, `date`, `datetime`, ou se terminant par `_at`, `_time`, `_date`,
  `timestamp`), sinon la première. Cette colonne est toujours lue, même si elle n'est pas sélectionnée, et la requête
  ne lit que les lignes de la plage temporelle de chaque exécution. Par exemple, avec les colonnes `tag` et `value`
  d'une table MSSQL sélectionnées :

  ```sql
  SELECT [timestamp], [tag], [value] FROM [dbo].[measures] WHERE [timestamp] > @StartTime AND [timestamp] <= @EndTime
  ```

  **Suivre l'instant** est activé sur cette colonne pour l'élément, avec le type date/heure correspondant à son type
  SQL, de sorte que chaque exécution reprend là où la précédente s'est arrêtée.

- Une table sans aucune colonne date/heure est lue entièrement à chaque exécution, sans suivi : vérifiez sa requête
  avant de l'activer.

Les noms de tables et de colonnes sont mis entre guillemets selon le dialecte SQL propre au connecteur. La requête
générée est un point de départ : modifiez ensuite l'élément pour filtrer les lignes ou renommer les colonnes.

---

## Stratégie de mise en cache {#caching-strategy}

Pour les **connecteurs de la famille IoT** (OPC UA, Modbus, ADS, OPC Classic, S7, MQTT, BACnet/IP), chaque élément peut filtrer
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

---

## Synchronisation des points {#items-synchronisation}

Plutôt que de créer et maintenir les éléments à la main, une **synchronisation des points** parcourt ou interroge la
source de données, conserve ce qui mérite d'être traité, puis en crée/met à jour des éléments ou le transmet à
OIAnalytics — exécutée une fois à la demande, ou selon une planification comme toute autre collecte.

Chaque synchronisation appartient à un connecteur South et s'exécute dans l'un de deux modes :

- **Créer/mettre à jour les points localement** — la synchronisation possède les éléments qu'elle crée, les met à
  jour lors des exécutions suivantes, et désactive (sans jamais les supprimer) ceux dont le point n'est plus trouvé.
- **Envoyer à OIAnalytics** — chaque exécution transmet les enregistrements découverts à OIAnalytics tels quels, sans
  correspondance de champs, sans élément local, et sans comparaison avec une exécution précédente. C'est le seul mode
  des connecteurs SQL (voir [Mode](#mode)).

Connecteurs pris en charge, et ce à partir de quoi ils découvrent :

| Famille de connecteurs                                 | Périmètre de découverte                                                                                        | Modes                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Arborescents** (OPC UA, BACnet/IP)                   | Les nœuds choisis dans l'arborescence d'exploration — ou toute la source de données lorsqu'aucun n'est choisi. | Local ou Envoyer à OIAnalytics   |
| **SQL** (MSSQL, MySQL, PostgreSQL, Oracle, SQLite)     | Une requête de métadonnées : chaque ligne qu'elle retourne est un enregistrement découvert.                    | Envoyer à OIAnalytics uniquement |
| Tout autre type de connecteur (Folder Scanner compris) | Pas encore pris en charge : l'étape Source affiche un court message à la place.                                | —                                |

:::tip Synchronisation des points ou Ajouter comme points ?
Pour créer des éléments une seule fois à partir de ce que contient la source de données, sélectionnez les nœuds dans
la fenêtre d'exploration et utilisez [Ajouter comme points](#adding-explored-nodes-as-items). Utilisez une
synchronisation des points lorsque la source de données évolue dans le temps (nouveaux points, points supprimés) et
que les éléments doivent suivre.
:::

### Gérer les synchronisations des points {#managing-items-synchronisations}

Sur la page d'un connecteur South, cliquez sur **Gérer les synchronisations des points** (à côté de **Gérer les
groupes**) pour lister les synchronisations du connecteur, et utilisez le bouton **+** pour en créer une. Chaque ligne
affiche le nom de la synchronisation, sa planification, son mode et si elle est activée, avec ces actions :

| Action                        | Description                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Exécuter maintenant** (▶)   | Déclenche immédiatement une exécution réelle — voir [Exécuter une synchronisation des points](#running-an-items-synchronisation).    |
| **Historique des exécutions** | Les exécutions passées, avec leur statut et leurs compteurs — voir [Historique des exécutions](#run-history).                        |
| **Modifier** (✏️)             | Ouvre la synchronisation dans l'assistant.                                                                                           |
| **Dupliquer**                 | Ouvre l'assistant pré-rempli avec les paramètres de cette synchronisation (nom suffixé par `-copy`), enregistrée comme une nouvelle. |
| **Supprimer**                 | Supprime la synchronisation. Les éléments qu'elle a créés et les métadonnées qu'elle a envoyées ne sont **pas** supprimés.           |

Une synchronisation peut aussi être créée depuis la [fenêtre d'exploration](#selecting-nodes) : sélectionnez des
nœuds, puis **Synchroniser…**.

Le même bouton **Gérer les synchronisations des points** se trouve sur la page de création/modification du
connecteur. Là, les modifications sont conservées dans la page et enregistrées avec le connecteur (comme les éléments
et les groupes), et les aperçus s'exécutent avec les paramètres du connecteur tels qu'ils sont en cours de
modification — une synchronisation peut donc être essayée avant que le connecteur lui-même ne soit enregistré.
**Exécuter maintenant** et **Historique des exécutions** ne sont disponibles que depuis la page du connecteur, une fois
celui-ci enregistré.

### L'assistant {#the-wizard}

Une synchronisation se crée et se modifie dans un assistant en cinq étapes. La barre d'étapes en haut indique où vous
en êtes, et un clic sur une étape l'ouvre.

| Étape             | Ce qu'elle définit                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Source**        | Le nom, et ce qu'il faut découvrir : les nœuds à parcourir, ou la requête de métadonnées SQL. |
| **Filtre**        | Les enregistrements découverts à traiter, avec un aperçu des enregistrements correspondants.  |
| **Points**        | Le mode, et pour le mode local, la façon dont un enregistrement devient un élément.           |
| **Planification** | Quand exécuter, et si les exécutions planifiées sont activées.                                |
| **Vérification**  | Un récapitulatif, et un aperçu de ce que ferait une exécution.                                |

**Suivant** quitte l'étape Source dès qu'elle a un nom (et une requête, pour SQL). Une nouvelle synchronisation
s'enregistre depuis l'étape Vérification ; une synchronisation en cours de modification peut être enregistrée depuis
n'importe quelle étape.

#### Source {#source}

- **Nom** — unique parmi les synchronisations du connecteur.
- **Périmètre de découverte** :
  - **Connecteurs arborescents** : **Choisir des nœuds...** ouvre l'arborescence d'exploration avec les nœuds actuels
    cochés ; cochez les nœuds à partir desquels découvrir et cliquez sur **Utiliser ces nœuds**. Un point vaut pour
    lui-même, tout autre nœud (un dossier, un appareil) pour tout ce qu'il contient. Retirez un nœud avec la croix de
    son badge. Sans aucun nœud, toute la source de données est découverte.
  - **Connecteurs SQL** : écrivez une requête de métadonnées dans l'éditeur SQL — indépendante de la requête propre à
    chaque élément, chaque ligne qu'elle retourne devient un enregistrement découvert (par ex.
    `SELECT tag, description, unit FROM tag_list`). Lorsque le connecteur peut être exploré, ses tables et colonnes
    sont affichées au-dessus de l'éditeur pour référence. **Tester la requête** exécute la requête et affiche ses
    lignes brutes, sous forme de tableau ou de JSON.

#### Filtre {#filter}

Le **Filtre d'éligibilité** liste les conditions qu'un enregistrement découvert doit **toutes** satisfaire (ET
logique) pour être traité — laissez-le vide pour rendre tous les enregistrements éligibles. Chaque condition possède :

| Paramètre     | Description                                                                                           | Exemple de valeur |
| ------------- | ----------------------------------------------------------------------------------------------------- | ----------------- |
| **Champ**     | Un champ de l'enregistrement découvert. Les champs des enregistrements de l'aperçu sont suggérés.     | `type`            |
| **Opérateur** | `égal à`, `différent de`, `contient`, `correspond à (regex)`, `existe`, `supérieur à`, `inférieur à`. | `égal à`          |
| **Valeur**    | La valeur de comparaison — non utilisée pour `existe`.                                                | `Variable`        |

Ajoutez une condition avec les champs sous le tableau ; modifiez-en ou supprimez-en une avec ses icônes crayon et
corbeille.

L'ouverture de l'étape découvre la source de données et affiche **Enregistrements correspondants : _éligibles_ sur
_découverts_**, avec les 20 premiers enregistrements correspondants dans un tableau, pour voir quels champs ils
possèdent. Cliquez sur **Actualiser l'aperçu** après avoir modifié les conditions. La découverte est un véritable
aller-retour vers la source de données : prévisualiser une source volumineuse coûte autant qu'une exécution, les
écritures en moins.

#### Points {#items-step}

##### Mode {#mode}

Choisissez **Créer/mettre à jour les points localement** ou **Envoyer à OIAnalytics**. Passer de l'un à l'autre
efface ce qui avait été configuré pour l'autre.

- **Envoyer à OIAnalytics** transmet tels quels à OIAnalytics les enregistrements éligibles de chaque exécution.
  L'enregistrement et l'exécution ne sont jamais bloqués par le statut d'enregistrement, mais l'envoi n'a lieu qu'une
  fois OIBus [enregistré auprès d'OIAnalytics](../installation/oianalytics.mdx) : d'ici là, un avertissement est
  affiché dans l'assistant, et chaque exécution journalise un avertissement et n'envoie rien.
- **Créer/mettre à jour les points localement** affiche la **Correspondance des champs des points** ci-dessous.

:::note Les connecteurs SQL envoient uniquement à OIAnalytics
Pour un connecteur SQL, un élément est une requête libre, et une requête peut retourner plusieurs points distincts à
la fois — élément et point n'y sont pas la même chose. Une synchronisation ne crée ni ne met jamais à jour d'éléments
pour ces connecteurs, et le choix du mode est remplacé par une note. Pour créer des éléments à partir de tables SQL,
utilisez [Ajouter comme points](#sql-tables-as-items) dans la fenêtre d'exploration.
:::

##### Correspondance des champs d'élément {#item-field-mapping}

Chaque champ des éléments du connecteur peut être associé à :

- **Non associé** — un nouvel élément reçoit la valeur par défaut habituelle du champ, comme dans la fenêtre de
  l'élément (un élément mis à jour conserve sa propre valeur),
- une constante (une liste déroulante pour les champs oui/non, à choix, de planification et de groupe ; du texte libre
  sinon), ou
- une expression `{{field}}` prenant une valeur dans l'enregistrement découvert — voir
  [Expressions de correspondance](#mapping-expressions).

**Nom**, **Groupe** et **Planification** sont affichés en premier. Sous le nom, **Exemples de noms de points** montre
les noms que donneraient les premiers enregistrements correspondants. La liste déroulante **Groupe** vaut **Aucun**
par défaut et permet de créer, modifier ou supprimer des groupes, comme dans la fenêtre de l'élément ; avec un
groupe, l'élément prend la planification du groupe.

Les autres champs, ainsi que les [champs de clé d'identité](#identity-key-fields), se trouvent sous **Avancé**.
Lorsque le connecteur a des [valeurs par défaut de découverte](#discovery-defaults), elles remplissent cette section,
qui reste repliée avec un résumé (par ex. `3 autres champs associés, enregistrements identifiés par id`) ; sinon, elle
s'ouvre dépliée, puisque tout doit être associé à la main.

Deux badges guident la correspondance :

- **Requis** — le champ doit être associé pour que l'élément soit valide, compte tenu des autres champs actuellement
  affichés. L'enregistrement est bloqué sinon. La planification en est dispensée dès que l'élément est associé à un
  groupe.
- **Contrôle la visibilité** — le champ détermine si d'autres champs s'appliquent, il ne peut donc prendre qu'une
  constante : sa valeur doit être connue lors de l'édition, et non résolue par enregistrement. Il en va de même pour le
  groupe, la planification et chaque paramètre d'historique (intervalle de lecture maximal, délai de lecture,
  décalages horaires, stratégie de récupération, synchronisation avec le groupe).

##### Champs de clé d'identité {#identity-key-fields}

Les **Champs de clé d'identité** désignent le ou les champs de l'enregistrement dont la valeur combinée identifie un
enregistrement d'une exécution à l'autre — par ex. `id` pour OPC UA et BACnet. Au moins un est requis en mode local :

- Une synchronisation locale redécouvre la source de données à chaque exécution, et rapproche les enregistrements de
  ceux de l'exécution précédente par cette clé : un enregistrement est nouveau, modifié ou inchangé, et une clé qui ne
  revient plus est manquante (voir [Exécuter une synchronisation des points](#running-an-items-synchronisation)). Si
  deux enregistrements d'une même exécution partagent une clé, le dernier l'emporte.
- **Envoyer à OIAnalytics** ne compare jamais les exécutions, il n'a donc pas de champs de clé d'identité : la
  corrélation des enregistrements d'une exécution à l'autre est laissée à OIAnalytics.

##### Expressions de correspondance {#mapping-expressions}

Les champs d'élément utilisent une syntaxe de substitution `{{field}}` :

- Une valeur qui est **exactement** une substitution (par ex. `{{nodeId}}`) prend la valeur brute de ce champ, en
  conservant son type — un champ numérique de l'enregistrement arrive intact sur un paramètre numérique, sans être
  converti en texte.
- Une substitution au sein d'un autre texte (par ex. `Sensor {{nodeId}}`) est une interpolation de chaîne — le
  résultat est toujours du texte.
- Un champ absent de l'enregistrement donne une valeur vide plutôt que de faire échouer l'exécution.

##### Valeurs par défaut de découverte {#discovery-defaults}

Les connecteurs dont les enregistrements découverts ont toujours la même forme sont fournis avec des valeurs par
défaut de découverte : une nouvelle synchronisation (et [Ajouter comme points](#adding-explored-nodes-as-items))
démarre avec ces champs de clé d'identité et cette correspondance, qui peuvent ensuite être modifiés.

| Connecteur | Clé d'identité | Correspondance des champs d'élément                                                                                                                                                                                                 |
| ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPC UA     | `id`           | Nom `{{path}}` (les noms d'affichage depuis la racine de découverte, joints par `/`), ID du nœud `{{nodeId}}`, mode `DA`, origine de l'horodatage `OIBus`. Voir [Métadonnées des nœuds](./opcua.mdx#node-metadata).                 |
| BACnet/IP  | `id`           | Nom `{{deviceName}} - {{name}}`, adresse et instance de l'appareil, type et instance de l'objet, routage (`{{routed}}`, numéro de réseau, adresse MAC) issus de l'enregistrement ; propriété `present-value`, fuseau horaire `UTC`. |

#### Planification {#schedule}

- **Planification** — le mode de scan qui pilote les exécutions planifiées. Laissez-le sur **Manuel uniquement** pour
  n'exécuter la synchronisation qu'avec **Exécuter maintenant**.
- **Activé** — indique si les exécutions planifiées se déclenchent. **Exécuter maintenant** fonctionne même lorsque la
  synchronisation est désactivée.

En mode local, un rappel indique que lorsqu'un point n'est plus trouvé, l'élément créé pour lui est désactivé.

#### Vérification {#review}

L'étape Vérification récapitule la synchronisation (nom, périmètre de découverte, nombre de conditions, mode,
planification) et prévisualise ce que ferait une exécution — l'ouverture de l'étape lance l'aperçu, **Actualiser
l'aperçu** le relance :

- **Créer/mettre à jour les points localement** : chaque enregistrement est classé par rapport à l'exécution
  précédente comme **Nouveau**, **Modifié**, **Inchangé**, **Réactivé** ou **Manquant**, avec sa clé d'identité et ses
  champs. Un enregistrement modifié met en évidence les champs qui diffèrent, avec la valeur précédente au survol ; un
  enregistrement manquant affiche les valeurs de l'exécution précédente, estompées.
- **Envoyer à OIAnalytics** : les enregistrements qui seraient envoyés, exactement tels que découverts.

**Exporter en CSV** télécharge les lignes de l'aperçu. Un aperçu n'écrit rien.

### Exécuter une synchronisation des points {#running-an-items-synchronisation}

Une exécution découvre toujours la source de données (telle que définie par le périmètre de découverte) et conserve
les enregistrements éligibles, puis agit selon le mode :

- **Créer/mettre à jour les points localement** rapproche les enregistrements éligibles de l'exécution précédente par
  clé d'identité : elle crée ou met à jour un élément pour chaque enregistrement nouveau, modifié ou réactivé, ignore
  les inchangés, et désactive — sans jamais le supprimer — l'élément de chaque enregistrement manquant, avec le motif
  "Configuration workflow no longer discovers this entry". Un nouvel élément reçoit la valeur par défaut habituelle de
  chaque champ que la correspondance ne couvre pas, lorsqu'elle s'applique.
- **Envoyer à OIAnalytics** transmet tels quels les enregistrements éligibles à OIAnalytics, sous la forme d'un message
  par exécution. Rien n'est créé, mis à jour ni désactivé.

:::tip Exécuter maintenant fonctionne sur un connecteur désactivé
Construire et tester une synchronisation ne nécessite pas d'activer d'abord le connecteur : **Exécuter maintenant**
fonctionne sur un connecteur désactivé, comme l'exploration. Une exécution **planifiée**, en revanche, est ignorée
tant que le connecteur South est désactivé.
:::

### Historique des exécutions {#run-history}

Chaque exécution — manuelle ou planifiée, réussie ou non — est enregistrée. La page **Historique des exécutions**,
ouverte depuis la liste des synchronisations, commence par un formulaire de recherche :

- **Démarré après / Démarré avant** — une plage de dates sur le démarrage de l'exécution.
- **Statut** et **Type de déclencheur** — des puces de filtre (cliquez à nouveau pour en retirer une, ou sur
  **Effacer** pour toutes les retirer). Chaque puce de statut a sa propre icône en plus de sa couleur (un indicateur de
  chargement pour En cours, une coche pour Terminé, une croix pour En erreur).

Le tableau affiche, par exécution :

| Colonne               | Description                                                                             |
| --------------------- | --------------------------------------------------------------------------------------- |
| **Statut**            | `En cours`, `Terminé` ou `En erreur`.                                                   |
| **Déclencheur**       | `Manuel` (Exécuter maintenant) ou `Planifié`.                                           |
| **Démarré / Terminé** | Quand l'exécution a démarré, et quand elle s'est terminée (le cas échéant).             |
| **Déclenché par**     | L'utilisateur qui a cliqué sur Exécuter maintenant ; vide pour une exécution planifiée. |
| **Découverts**        | Le nombre d'enregistrements découverts par l'exécution, avant le filtre d'éligibilité.  |
| **Erreur**            | Le message d'échec, si l'exécution est en erreur — **Ø** sinon.                         |

**Voir la charge utile** (👁) sur une ligne ouvre ce que l'exécution a fait, tel que l'étape Vérification le
prévisualise : les enregistrements classés **Nouveau**, **Modifié**, **Inchangé**, **Réactivé** ou **Manquant** (mode
local) ou les enregistrements envoyés (Envoyer à OIAnalytics), avec les compteurs créés / mis à jour / désactivés /
envoyés et **Exporter en CSV**. Ce sont les données sur lesquelles l'exécution a agi, stockées au moment de
l'exécution — pas une nouvelle requête — elles restent donc exactes même si la source de données a changé depuis.
Indisponible tant que l'exécution est encore `En cours`.
