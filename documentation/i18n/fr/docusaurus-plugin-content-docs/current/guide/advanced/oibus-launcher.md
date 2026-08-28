---
sidebar_position: 5
---

# OIBus Launcher

En production, OIBus s'exécute en tant que **service système**. Le service ne démarre pas directement le binaire `oibus`
— il démarre `oibus-launcher`, qui gère ensuite `oibus` comme un processus enfant.

Cette indirection est ce qui rend les [mises à jour à distance depuis OIAnalytics](../installation/oianalytics.mdx) sûres :
le launcher peut remplacer le binaire, détecter un démarrage échoué, et revenir en arrière automatiquement — le tout sans
intervention humaine.

## Vue d'ensemble des composants {#component-overview}

| Composant           | Binaire          | Rôle                                                                                        |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| **OIBus Launcher** | `oibus-launcher` | Géré par le service de l'OS. Gère les mises à jour, la récupération après crash, et le cycle de vie du processus enfant. |
| **OIBus**          | `oibus`          | L'application principale. Démarrée et surveillée par le launcher.                            |

## Structure des dossiers {#folder-structure}

Le launcher attend la structure suivante dans son répertoire de travail (le dossier d'installation d'OIBus) :

```
OIBus/
├── oibus-launcher          ← the launcher binary (run by the OS service)
├── binaries/
│   └── oibus               ← active OIBus binary (oibus.exe on Windows)
├── update/                 ← staged update dropped here by the upgrade process
│   └── binaries/
│       └── oibus
└── backup/                 ← created automatically before an upgrade
    ├── oibus
    └── data-folder/        ← backup of the data folder (see note below)
```

:::info Sauvegarde partielle du dossier de données
Seules les parties du dossier de données correspondant à un motif configurable sont sauvegardées dans `data-folder/` —
par défaut, tout ce qui se trouve sous `cache/`. Il ne s'agit pas d'un instantané complet du dossier de données. Le motif peut
être remplacé par une entrée `backupFolders` dans `update.json`, déposée à côté de la mise à jour préparée.
:::

Lorsqu'une commande de mise à jour est reçue depuis OIAnalytics, le nouveau binaire est placé dans `update/binaries/`.
Le launcher le détecte au démarrage suivant.

## Séquence de démarrage {#startup-sequence}

À chaque démarrage de `oibus-launcher`, la séquence suivante est suivie :

1. **Vérifier la présence d'une mise à jour préparée** — inspecter le dossier `update/` pour de nouveaux binaires.

2. **Appliquer la mise à jour** (si des fichiers sont présents) :
   - Sauvegarder le binaire actuel depuis `binaries/` et les parties correspondantes du dossier de données vers `backup/`.
   - Remplacer le binaire dans `binaries/` par celui de `update/`.

3. **Démarrer OIBus** — lancer `oibus` depuis `binaries/` en tant que processus enfant, en transmettant tous les arguments CLI.

4. **Surveiller pendant 30 secondes** — si OIBus se termine ou plante dans les 30 secondes suivant une mise à jour, le launcher
   considère qu'il s'agit d'une mise à jour échouée :
   - Arrête le processus en échec.
   - Restaure le binaire précédent et les parties sauvegardées du dossier de données depuis `backup/`.
   - Redémarre OIBus à partir du binaire restauré.

5. **Marquer comme stable** — si OIBus fonctionne toujours après 30 secondes, la mise à jour est considérée comme réussie
   et la sauvegarde est nettoyée.

:::info Aucune mise à jour trouvée
Si le dossier `update/` est vide, le launcher saute les étapes 1 à 2 et passe directement à l'étape 3.
:::

:::tip Récupération après crash
La même logique de surveillance s'applique même sans mise à jour. Si OIBus plante pour une raison quelconque, le launcher
le redémarre automatiquement — se comportant comme un superviseur de processus.
:::

## Arguments en ligne de commande {#command-line-arguments}

Tous les arguments passés à `oibus-launcher` (à l'exception de `--reset-password`) sont transmis au processus enfant
`oibus`. Le launcher injecte également automatiquement `--launcherVersion <version>` afin qu'OIBus sache quelle
version du launcher le gère.

### `--config` {#--config}

Chemin vers le dossier de données OIBus. Par défaut `./` si omis.

```bash
oibus-launcher --config /path/to/OIBusData
```

```batch
oibus-launcher --config C:\OIBusData
```

### `--version` {#--version}

Affiche les versions de `oibus-launcher` et `oibus`, puis se termine. Le launcher vérifie tout de même si une
mise à jour préparée est présente, mais ne l'applique pas — l'échange de binaire/dossier de données est ignoré.

```bash
oibus-launcher --version
```

### `--reset-password` {#--reset-password}

Réinitialise les identifiants de l'utilisateur admin aux valeurs par défaut (`admin` / `pass`) et se termine immédiatement.
Fournissez toujours `--config` avec ce drapeau pour que le launcher trouve la bonne base de données.

```bash
oibus-launcher --reset-password --config /path/to/OIBusData
```

**Étapes de récupération après un mot de passe oublié :**

1. Arrêter le service OIBus.
2. Exécuter la commande ci-dessus.
3. Redémarrer le service.
4. Se connecter avec `admin` / `pass` et changer le mot de passe immédiatement dans les
   [Paramètres utilisateur](../installation/first-access.mdx#user-settings).

:::caution
`--reset-password` est traité uniquement par le launcher et n'est jamais transmis au binaire `oibus`.
:::
