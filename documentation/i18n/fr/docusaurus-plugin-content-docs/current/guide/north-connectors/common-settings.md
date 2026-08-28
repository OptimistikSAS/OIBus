---
sidebar_position: 0
---

# Paramètres communs

Un **connecteur North** envoie des données d'OIBus vers une application cible. Cette page explique comment configurer et
gérer les connecteurs North.

## Ajouter un connecteur North {#adding-a-north-connector}

1. Accédez à la page **North**.
2. Cliquez sur le bouton **+**.
3. Sélectionnez un type de connecteur et configurez ses paramètres.
4. Surveillez ou ajustez les paramètres depuis la page d'affichage du connecteur.

## Paramètres généraux {#general-settings}

| Paramètre        | Description                                                                                | Exemple de valeur    |
| ----------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| **Nom**           | Un libellé convivial pour identifier l'objectif du connecteur.                               | `My MQTT Connector`   |
| **Description**   | Détails facultatifs sur la connexion, les droits d'accès ou les caractéristiques uniques.     | `Production broker`   |
| **Activé**        | Activer ou désactiver le connecteur (depuis la liste ou sa page d'affichage).                | Activé/Désactivé      |

:::caution Connecteurs North désactivés
Un connecteur North désactivé **ne mettra en cache aucune donnée**.
:::

## Section spécifique {#specific-section}

Reportez-vous à la documentation de chaque connecteur pour les paramètres propres à son type.

### Test de la connexion {#testing-connection}

Utilisez le bouton **Tester les paramètres** pour vérifier votre configuration de connexion.

## Paramètres de cache {#cache-settings}

### Conditions de déclenchement {#trigger-conditions}

Configurez le moment où les données sont envoyées à l'application cible :

| Paramètre                    | Description                                                                                            | Exemple de valeur |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| **Planification**             | Définit la fréquence de transmission des données. Configurez à l'aide des [modes de scrutation](../engine/scan-modes.mdx). | `Every 10 s`         |
| **Nombre d'éléments**         | (Charges utiles JSON) Envoie les données lorsque le nombre d'éléments spécifié est atteint, en contournant la planification. | `1000`               |
| **Nombre de fichiers**        | (Fichiers) Envoie les données lorsque le nombre de fichiers spécifié est atteint, en contournant la planification. | `10`                 |

### Limitation de débit {#throttling}

Contrôlez la transmission des données pour éviter de surcharger la cible ou le réseau :

| Paramètre                                    | Description                                                                                              | Exemple de valeur |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Délai minimum entre les transmissions**      | Temps (en millisecondes) à attendre entre les transmissions.                                                   | `1000`               |
| **Nombre maximum d'éléments**                  | Nombre maximum d'éléments envoyés dans une seule transmission.                                                 | `10000`              |
| **Taille de stockage maximale**                | Taille maximale (en Mo) pour le cache + les erreurs + l'archive. Les données excédentaires sont supprimées une fois la limite atteinte. | `1000`               |

### Erreurs {#errors}

Gérez la manière dont OIBus traite les échecs de transmission :

| Paramètre                                     | Description                                                                        | Exemple de valeur |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------- |
| **Délai d'attente avant nouvelle tentative**     | Temps (en millisecondes) à attendre avant de réessayer après un échec.                  | `5000`               |
| **Nombre de tentatives**                         | Nombre de tentatives avant de déplacer les données en échec vers le dossier d'erreurs. | `3`                  |
| **Durée de rétention des données en erreur**     | Durée (en heures) de conservation des données en erreur. Réglez sur `0` pour une conservation illimitée. | `72`                 |

:::tip Envoi avec nouvelles tentatives
Certains connecteurs North, comme le [connecteur North OIAnalytics](./oianalytics.md), **réessaieront indéfiniment**
d'envoyer les données pour certaines erreurs, même après que le nombre de tentatives ait été dépassé. Cela couvre les
défaillances réseau ainsi que certaines réponses d'erreur HTTP (par exemple des erreurs d'authentification ou de
limitation de débit) censées se résoudre une fois le problème sous-jacent — une clé API mal configurée, une panne
temporaire — corrigé, plutôt que de déplacer les données vers le dossier d'erreurs.
:::

### Archive {#archive}

Activez l'archivage pour conserver les données transmises :

| Paramètre                                    | Description                                                                        | Exemple de valeur |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------- |
| **Activé**                                     | Bascule pour activer ou désactiver l'archivage.                                          | Activé/Désactivé    |
| **Durée de rétention des données archivées**   | Durée (en heures) de conservation des données archivées. Réglez sur `0` pour une conservation illimitée. | `168`                |

:::caution Espace disque
Si les fichiers sont conservés indéfiniment, videz manuellement le dossier d'archive périodiquement pour éviter une
utilisation excessive de l'espace disque.
:::

## Transformateurs {#transformers}

Les transformateurs s'exécutent **avant la mise en cache des données** — ils traitent les données entrantes provenant
des connecteurs South et déterminent ce qui entre réellement dans le cache du connecteur North. Vous pouvez appliquer un
ou plusieurs transformateurs à un connecteur North pour :

- **Filtrer les données** : inclure ou exclure des points de données spécifiques en fonction du type de source.
- **Modifier les données** : changer des valeurs, renommer des champs ou restructurer les données.
- **Enrichir les données** : ajouter du contexte ou des métadonnées supplémentaires.
- **Convertir les formats** : transformer les données entre différents formats (par exemple, de JSON vers CSV).

Chaque transformateur est associé à un **type de source** (le type de données qu'il accepte). Lors de l'ajout d'un
transformateur, vous sélectionnez d'abord le type de source, puis vous choisissez un transformateur compatible pour ce
type de connecteur North.

:::info Transformateurs standard
Les transformateurs standard sont préconstruits et disponibles en fonction du type de source et du type de connecteur
North. Ces transformateurs couvrent les cas d'usage courants et peuvent être configurés directement dans l'interface
utilisateur.
:::

:::tip Transformateurs personnalisés
Pour les cas d'usage avancés, vous pouvez créer des transformateurs personnalisés :

- Accédez à la [section transformateurs du moteur](../engine/transformers.mdx).
- Créez un nouveau transformateur avec votre propre code.
- Définissez des options configurables pour le transformateur.

Votre transformateur personnalisé sera alors disponible à la sélection dans les paramètres du connecteur North.

:::

## Filtrage des données {#data-filtering}

Les transformateurs constituent également le mécanisme de filtrage des données reçues par un connecteur North. En
sélectionnant un type de source spécifique lors de l'ajout d'un transformateur, vous contrôlez quels types de données
sont acceptés dans le cache.

:::info Comportement actuel
Les données qui arrivent sur un connecteur North et qui sont **compatibles avec son type** sont mises en cache et
envoyées par défaut, même si aucun transformateur n'est configuré pour ce type de source.

Ce comportement par défaut est appelé à changer dans une future version d'OIBus : les données non appariées seront
**ignorées par défaut** plutôt que transmises. Si vous vous appuyez aujourd'hui sur cette transmission implicite,
ajoutez un transformateur explicite pour conserver ce comportement après la mise à niveau.
:::
