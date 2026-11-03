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

| Paramètre       | Description                                                                               | Exemple de valeur   |
| --------------- | ----------------------------------------------------------------------------------------- | ------------------- |
| **Nom**         | Un libellé convivial pour identifier l'objectif du connecteur.                            | `My MQTT Connector` |
| **Description** | Détails facultatifs sur la connexion, les droits d'accès ou les caractéristiques uniques. | `Production broker` |
| **Statut**      | Activer ou désactiver le connecteur (depuis la liste ou sa page d'affichage).             | Activé/Désactivé    |

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

| Paramètre              | Description                                                                                                                                                       | Exemple de valeur |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Planification**      | Définit la fréquence de transmission des données. Configurez à l'aide des [modes de scan](../engine/scan-modes.mdx).                                              | `Every 10 s`      |
| **Nombre d'éléments**  | (Listes d'enregistrements) Envoie les données lorsque le nombre d'éléments spécifié est atteint, en contournant la planification. `0` désactive ce déclenchement. | `1000`            |
| **Nombre de fichiers** | (Fichiers) Envoie les données lorsque le nombre de fichiers spécifié est atteint, en contournant la planification. `0` désactive ce déclenchement.                | `10`              |

### Limitation {#throttling}

Contrôlez la transmission des données pour éviter de surcharger la cible ou le réseau :

| Paramètre                                  | Description                                                                                                                                                         | Exemple de valeur |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Délai minimum entre deux transmissions** | Temps (en millisecondes) à attendre entre les transmissions.                                                                                                        | `1000`            |
| **Nombre maximal d'éléments**              | Nombre maximum d'éléments envoyés dans une seule transmission.                                                                                                      | `10000`           |
| **Taille maximale de stockage**            | Taille maximale (en Mo) pour le cache + les erreurs + l'archive. Les données excédentaires sont supprimées une fois la limite atteinte. `0` signifie aucune limite. | `1000`            |

### Erreurs {#errors}

Gérez la manière dont OIBus traite les échecs de transmission :

| Paramètre                                                 | Description                                                                                              | Exemple de valeur |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| **Délai d'attente avant nouvelle tentative après erreur** | Temps (en millisecondes) à attendre avant de réessayer après un échec.                                   | `5000`            |
| **Nombre de tentatives**                                  | Nombre de tentatives avant de déplacer les données en échec vers le dossier d'erreurs.                   | `3`               |
| **Durée de rétention des données en erreur**              | Durée (en heures) de conservation des données en erreur. Réglez sur `0` pour une conservation illimitée. | `72`              |

:::tip Envoi avec nouvelles tentatives
Certains connecteurs North, comme le [connecteur North OIAnalytics](./oianalytics.md), **réessaieront indéfiniment**
d'envoyer les données pour certaines erreurs, même après que le nombre de tentatives ait été dépassé. Cela couvre les
défaillances réseau ainsi que certaines réponses d'erreur HTTP (par exemple des erreurs d'authentification ou de
limitation de débit) censées se résoudre une fois le problème sous-jacent — une clé API mal configurée, une panne
temporaire — corrigé, plutôt que de déplacer les données vers le dossier d'erreurs.
:::

### Archive {#archive}

Activez l'archivage pour conserver les données transmises :

| Paramètre                                    | Description                                                                                              | Exemple de valeur |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| **Activé**                                   | Bascule pour activer ou désactiver l'archivage.                                                          | Activé/Désactivé  |
| **Durée de rétention des données archivées** | Durée (en heures) de conservation des données archivées. Réglez sur `0` pour une conservation illimitée. | `168`             |

:::caution Espace disque
Si les fichiers sont conservés indéfiniment, videz manuellement le dossier d'archive périodiquement pour éviter une
utilisation excessive de l'espace disque.
:::

## Transformateurs {#transformers}

Les transformateurs s'exécutent **avant la mise en cache des données** — ils traitent les données entrantes provenant
des connecteurs South et déterminent ce qui entre réellement dans le cache du connecteur North. Vous pouvez appliquer un
ou plusieurs transformateurs à un connecteur North pour :

- **Filtrer les données** : inclure ou exclure des points de données spécifiques en fonction de leur source.
- **Modifier les données** : changer des valeurs, renommer des champs ou restructurer les données.
- **Enrichir les données** : ajouter du contexte ou des métadonnées supplémentaires.
- **Convertir les formats** : transformer les données entre différents formats (par exemple, de JSON vers CSV).

Chaque transformateur est associé à une **source** (un connecteur South, l'API OIBus ou les consignes OIAnalytics) et,
pour un connecteur South, aux items auxquels il s'applique. Lors de l'ajout d'un transformateur, vous sélectionnez
d'abord la source, puis vous choisissez un transformateur compatible pour ce type de connecteur North. Voir
[Configurer un transformateur](../engine/transformers.mdx#configuring-a-transformer).

:::info Transformateurs standard
Les transformateurs standard sont préconstruits et disponibles en fonction de la source et du type de connecteur
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

Les transformateurs constituent également le mécanisme de filtrage des données reçues par un connecteur North : un
connecteur North ne met en cache que les données des sources (et des items) pour lesquelles un transformateur est
configuré. **Les données sans transformateur sont ignorées.**

Pour envoyer les données telles quelles, utilisez un transformateur de passage direct :
[Fichier (tel quel, renommé ou converti)](../engine/transformers.mdx#file-as-is-renamed-or-converted) pour les fichiers
et les charges utiles JSON, ou [Fichier](../engine/transformers.mdx#file-from-records) pour les listes d'enregistrements
(consignes OIAnalytics comprises).

:::info Mise à jour vers la 3.10
Avant la 3.10, les données compatibles avec le type du connecteur North étaient mises en cache sans transformateur, et
les transformateurs **Pas de transformation** et **Ignorer** les forçaient ou les empêchaient. Lors de la mise à jour,
OIBus ajoute les transformateurs de passage direct reproduisant ce que chaque connecteur North recevait (au niveau du
connecteur South, afin que les nouveaux items soient toujours envoyés), remplace **Pas de transformation** par ceux-ci,
et écarte les items réglés sur **Ignorer** des transformateurs dont ils héritaient (**Sauf certains items** ; pour les
requêtes d'historique, ces transformateurs sont restreints à la liste des autres items). Les fichiers de l'API OIBus
passent par un transformateur **Fichier (tel quel, renommé ou converti)** s'appliquant à toutes les sources de données.
:::
