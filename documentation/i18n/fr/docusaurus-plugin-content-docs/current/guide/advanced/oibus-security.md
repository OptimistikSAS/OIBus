---
sidebar_position: 3
---

# Sécurité d'OIBus

## Stockage des identifiants {#credential-storage}

### Mots de passe de connexion {#login-passwords}

Les mots de passe utilisateurs sont hachés avec **Argon2** avant d'être stockés dans `oibus.db`. Le mot de passe en clair n'est
jamais persisté — seul le hash l'est. Argon2 est une fonction de hachage exigeante en mémoire, conçue pour résister aux attaques
par force brute et aux attaques accélérées par GPU.

### Secrets des connecteurs {#connector-secrets}

Les mots de passe, jetons et clés API configurés dans les connecteurs South et North sont chiffrés au repos avec
**AES-256-CBC** :

- Une clé de 256 bits et un vecteur d'initialisation (IV) de 128 bits sont générés avec un générateur de nombres
  aléatoires cryptographiquement sûr lors de l'initialisation d'OIBus.
- La clé et l'IV sont stockés sous forme de chaînes base64 dans **`crypto.db`** — une base de données SQLite distincte
  de la base de données de configuration principale.
- Les secrets chiffrés sont stockés dans **`oibus.db`** et ne peuvent être déchiffrés que lorsque les deux bases de données
  sont présentes.

:::danger Protégez crypto.db
Si `crypto.db` est supprimé ou perdu, OIBus ne peut plus déchiffrer aucun secret de connecteur. Tous les secrets doivent
être ressaisis après le redémarrage d'OIBus. Traitez `crypto.db` avec la même précaution qu'un fichier de clé privée.
:::

### Organisation des bases de données {#database-layout}

OIBus utilise cinq bases de données SQLite :

| Base de données  | Contenu                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **`oibus.db`**   | Toute la configuration : connecteurs, items, modes de scan, filtres IP, utilisateurs (mots de passe hachés), secrets chiffrés. |
| **`crypto.db`**  | Clé et IV AES-256-CBC utilisés pour chiffrer/déchiffrer les secrets des connecteurs.                                          |
| **`logs.db`**    | Entrées de journal d'exécution. Stockées dans le sous-dossier `logs/`.                                                        |
| **`metrics.db`** | Métriques d'exécution South/North/history-query, mises à jour à chaque scan et chaque envoi North. Stockées dans le sous-dossier `logs/`. |
| **`cache.db`**   | Cache du connecteur South (valeurs en attente de transmission vers les connecteurs North). Stocké dans le sous-dossier `cache/`. |

Sauvegarder à la fois `oibus.db` et `crypto.db` ensemble est nécessaire pour obtenir un instantané complet et restaurable.

## Authentification de l'interface web {#web-interface-authentication}

L'interface web d'OIBus prend en charge deux méthodes d'authentification :

### JWT (principal) {#jwt-primary}

Après une connexion réussie, OIBus émet un **JWT signé avec RS256** (RSA-SHA256). Le jeton :

- A une **durée de vie de 7 jours par défaut**, configurable dans les paramètres du moteur de 1 heure jusqu'à 30 jours.
- Est signé avec une clé privée RSA détenue par OIBus.
- Est vérifié à chaque requête API à l'aide de la clé publique correspondante.
- Contient l'identifiant de connexion de l'utilisateur et un hash de son mot de passe — le jeton est automatiquement invalidé si le
  mot de passe change.

### Basic Auth (API / CLI) {#basic-auth-api--cli}

L'authentification HTTP Basic est également acceptée sur chaque point de terminaison de l'API, à l'exception des points de terminaison
de statut publics (`/api/status`, `/api/engine/status`), qui ne nécessitent aucune authentification. Elle est utilisée par les scripts
d'automatisation basés sur curl (voir [installation automatisée](../installation/disk-image.mdx)) et par les outils qui ne prennent pas en charge JWT.

:::tip
Pour un accès scripté, privilégiez une approche API dédiée et exécutez toujours les scripts sur l'hôte OIBus lui-même
(`localhost`) afin que les identifiants ne soient pas transmis sur le réseau sans chiffrement.
:::

## Filtrage IP {#ip-filtering}

OIBus applique un contrôle d'accès basé sur l'IP au niveau des requêtes HTTP. Les requêtes provenant d'adresses non listées
reçoivent une réponse HTTP 401 avant toute tentative d'authentification.

Comportements clés :

| Comportement               | Détail                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Contournement localhost** | `127.0.0.1`, `::1`, et les autres adresses de bouclage sont toujours autorisées, quelle que soit la liste de filtres. |
| **Caractère générique**     | Une entrée `*` autorise toutes les adresses distantes.                                                              |
| **IPv4 / IPv6**              | Les deux formats sont pris en charge. Les adresses IPv6 mappées IPv4 (par ex. `::ffff:192.168.1.1`) sont gérées de manière transparente. |
| **Correspondance de motifs** | Les entrées prennent en charge `*` comme caractère générique (compilé en interne en expression régulière), permettant des règles de type sous-réseau. |
| **Désactiver pour les tests** | Passez `--ignore-ip-filters` à `oibus-launcher` pour contourner tous les contrôles IP sans modifier la configuration. |

Voir [Filtres IP](../engine/ip-filters.mdx) pour les détails de configuration.

## Échange de secrets OIAnalytics {#oianalytics-secret-exchange}

Lorsque des secrets sont saisis ou mis à jour via OIAnalytics, ils sont chiffrés **dans le navigateur** avant
d'être transmis, en utilisant la clé publique RSA d'OIBus (RSA-OAEP, 4096 bits). Cela signifie que :

- OIAnalytics ne voit ni ne stocke jamais de secrets en clair.
- Seul OIBus, détenant la clé privée correspondante, peut les déchiffrer.
- Lorsque OIBus envoie sa configuration à OIAnalytics, tous les champs de secrets sont retirés avant
  la transmission.

La paire de clés RSA est générée lors de l'enregistrement OIAnalytics et peut être renouvelée avec la
commande à distance **Regenerate cipher keys**. Après le renouvellement, tout secret précédemment saisi via
OIAnalytics doit être ressaisi car l'ancien texte chiffré ne peut plus être déchiffré.

Séparément, OIBus génère sa propre paire certificat/clé RSA de 4096 bits au démarrage (`private.pem` /
`public.pem` / `cert.pem`) — c'est ce qui signe les JWT décrits ci-dessus, et c'est également utilisé pour auto-signer
le certificat présenté pour les connexions OPC UA. Il s'agit d'une paire de clés distincte de celle utilisée pour
l'échange de secrets OIAnalytics.

## Sécurité réseau {#network-security}

OIBus ne prend **pas** en charge HTTPS nativement. L'interface web fonctionne en HTTP simple (port 2223 par défaut).

Pour les environnements de production où l'interface est accédée à distance :

1. Placez OIBus derrière un **reverse proxy** (nginx, Apache, Caddy) qui termine le TLS.
2. Configurez le proxy pour transmettre les requêtes vers `http://localhost:2223`.
3. Utilisez les [filtres IP](../engine/ip-filters.mdx) pour empêcher l'accès direct sur le port 2223 depuis l'extérieur de l'hôte.
4. Pour un accès externe, privilégiez un **VPN** plutôt que d'exposer le reverse proxy à l'internet public.

## Accès aux sources de données {#data-source-access}

Appliquez le principe du moindre privilège pour chaque système auquel OIBus se connecte :

- Créez un **compte dédié** pour OIBus — ne réutilisez pas de comptes de service partagés avec d'autres outils.
- Accordez des **permissions en lecture seule** pour les connecteurs South qui ne font qu'interroger des données.
- Restreignez le compte aux bases de données, tags ou topics spécifiques dont il a besoin — rien de plus large.
- Privilégiez une **authentification par clé ou par jeton** plutôt que par mot de passe lorsque le protocole le permet.
- Renouvelez les identifiants périodiquement et mettez-les à jour dans les paramètres des connecteurs OIBus.

## Intégrité du logiciel {#software-integrity}

- **Open source** : le code source complet est publiquement disponible sur
  [GitHub](https://github.com/OptimistikSAS/OIBus). Tous les commits passent par une revue d'équipe avant fusion.
- **Builds officiels** : les binaires de release sont construits par GitHub Actions à partir de la source taguée. Le pipeline
  de build est auditable via les workflows Actions du dépôt.
- **Surveillance des dépendances** : [Dependabot](https://github.com/OptimistikSAS/OIBus/security/dependabot)
  analyse en continu les dépendances à la recherche de vulnérabilités connues et ouvre des pull requests pour les mettre à jour.
- **Compilation personnalisée** : la licence open source et le code source public vous permettent de compiler OIBus depuis
  la source et de l'auditer indépendamment avant de le déployer dans des environnements sensibles.
- **Nomenclature logicielle** : chaque release stable livre une SBOM CycloneDX (`oibus-sbom.json`)
  listant tous les composants et leurs versions, prête pour l'analyse de vulnérabilités ou la conformité des licences.
  Voir [Nomenclature logicielle (SBOM)](./oibus-sbom.md) pour plus de détails.
