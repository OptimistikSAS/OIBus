---
sidebar_position: 3
---

# Sécurité d'OIBus

## Stockage des identifiants {#credential-storage}

### Mots de passe de connexion {#login-passwords}

Les mots de passe utilisateurs sont hachés avec **Argon2id** (64 Mio de mémoire, 3 itérations, 4 voies, un sel aléatoire de
16 octets) avant d'être stockés dans `oibus.db`. Le mot de passe en clair n'est jamais persisté — seul le hash l'est. Argon2 est
une fonction de hachage exigeante en mémoire, conçue pour résister aux attaques par force brute et aux attaques accélérées par
GPU. Quand une version plus récente d'OIBus hache les mots de passe avec des paramètres plus forts, un mot de passe est haché à
nouveau avec eux à la connexion suivante de son utilisateur.

### Politique de mot de passe {#password-policy}

Conformément à la [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html), un mot de passe doit comporter **de 8 à
128 caractères**, de toute nature. OIBus n'impose aucune règle de composition (majuscule, chiffre, caractère spécial…) : une
longue phrase de passe est à la fois plus facile à retenir et plus difficile à deviner.

Changer un mot de passe demande le mot de passe actuel de l'utilisateur qui le change : le sien, et le sien aussi quand il change
le mot de passe d'un autre utilisateur via l'API.

### Compte par défaut {#default-account}

À son premier démarrage, OIBus crée un compte **admin** avec le mot de passe **pass**, sauf si l'installation définit d'autres
identifiants (les options `-u` et `-p` des scripts d'installation, ou les variables d'environnement `ADMIN_USERNAME` et
`ADMIN_PASSWORD`). L'option `--reset-password` du launcher redonne aussi ce mot de passe par défaut au compte **admin**.

Tant qu'un compte a le mot de passe par défaut, OIBus ne le laisse que changer son mot de passe : l'interface web ouvre le
changement de mot de passe dès la connexion, et l'API refuse toute autre requête avec une réponse HTTP 403. Cela s'applique aussi
aux comptes qui ont encore le mot de passe par défaut lors de la mise à jour d'OIBus.

### Secrets des connecteurs {#connector-secrets}

Les mots de passe, jetons et clés API configurés dans les connecteurs South et North — ainsi que les jetons et clés de
l'enregistrement OIAnalytics, les mots de passe du proxy de redirection et de Loki, et les clés privées des certificats —
sont chiffrés au repos avec **AES-256-GCM** :

- Une clé de 256 bits est générée avec un générateur de nombres aléatoires cryptographiquement sûr lors de
  l'initialisation d'OIBus, et stockée sous forme de chaîne base64 dans **`crypto.db`** — une base de données SQLite
  distincte de la base de données de configuration principale. La clé de chiffrement en est dérivée avec HKDF-SHA256.
- Chaque secret est chiffré avec son propre nonce aléatoire de 96 bits, de sorte que deux secrets identiques ne donnent
  jamais la même valeur chiffrée, et porte une étiquette d'authentification, de sorte qu'une valeur altérée est rejetée
  au lieu d'être déchiffrée.
- Les secrets chiffrés sont stockés dans **`oibus.db`** et ne peuvent être déchiffrés que lorsque les deux bases de données
  sont présentes.

:::danger Protégez crypto.db
Si `crypto.db` est supprimé ou perdu, OIBus ne peut plus déchiffrer aucun secret de connecteur. Tous les secrets doivent
être ressaisis après le redémarrage d'OIBus. Traitez `crypto.db` avec la même précaution qu'un fichier de clé privée.
:::

### Organisation des bases de données {#database-layout}

OIBus utilise cinq bases de données SQLite :

| Base de données  | Contenu                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`oibus.db`**   | Toute la configuration : connecteurs, éléments, modes de scan, filtres IP, utilisateurs (mots de passe hachés), secrets chiffrés.                |
| **`crypto.db`**  | Clé dont est dérivée la clé AES-256-GCM qui chiffre/déchiffre les secrets.                                                                       |
| **`logs.db`**    | Entrées de journal d'exécution. Stockées dans le sous-dossier `logs/`.                                                                           |
| **`metrics.db`** | Métriques d'exécution South/North/requête d'historique, mises à jour à chaque scan et chaque envoi North. Stockées dans le sous-dossier `logs/`. |
| **`cache.db`**   | Cache du connecteur South (valeurs en attente de transmission vers les connecteurs North). Stocké dans le sous-dossier `cache/`.                 |

Sauvegarder à la fois `oibus.db` et `crypto.db` ensemble est nécessaire pour obtenir un instantané complet et restaurable.

### Permissions des fichiers {#file-permissions}

Le dossier de données contient la configuration (hash des mots de passe, secrets chiffrés), la clé des secrets et la clé
privée d'OIBus. Son accès est restreint au compte qui exécute OIBus à sa création, puis laissé à l'administrateur, qui
peut le modifier (par exemple pour qu'un agent de sauvegarde puisse le lire) :

- Les installeurs créent un nouveau dossier de données pour ce seul compte : mode `700` sous Linux, et sous Windows une
  liste de contrôle d'accès donnant le contrôle total au service OIBus (`SYSTEM`) et aux administrateurs uniquement,
  sans les permissions héritées de son dossier parent. Un dossier de données existant est laissé tel quel.
- Sous Linux et macOS, OIBus crée `oibus.db` et `crypto.db` pour son seul utilisateur (mode `600`). La mise à jour vers
  OIBus 4.0 restreint une fois ceux créés auparavant.

Sous Windows, restreignez de la même façon un dossier de données existant depuis une invite de commandes administrateur :

```bat
icacls "C:\OIBusData" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F"
```

Exécuter OIBus de manière interactive (`go.bat`) nécessite alors une invite de commandes administrateur.

## Authentification de l'interface web {#web-interface-authentication}

L'interface web d'OIBus prend en charge deux méthodes d'authentification :

### JWT (principal) {#jwt-primary}

Après une connexion réussie, OIBus émet un **JWT signé avec HS256** (HMAC-SHA256). Le jeton :

- A une **durée de vie de 7 jours par défaut**, configurable dans les paramètres du moteur de 1 heure jusqu'à 30 jours.
- Est signé avec un secret aléatoire de 256 bits généré par OIBus et stocké dans `crypto.db`, qui ne sert à rien d'autre.
- Est vérifié à chaque requête API avec ce même secret : un jeton signé autrement, ou avec un autre algorithme, est
  rejeté.
- Contient l'identifiant de connexion de l'utilisateur et une empreinte du hash de son mot de passe (jamais le hash lui-même) —
  le jeton est automatiquement invalidé si le mot de passe change.

### Basic Auth (API / CLI) {#basic-auth-api--cli}

L'authentification HTTP Basic est également acceptée sur chaque point de terminaison de l'API, à l'exception des points de terminaison
de statut publics (`/api/status`, `/api/engine/status`), qui ne nécessitent aucune authentification. Elle est utilisée par les scripts
d'automatisation basés sur curl (voir [installation automatisée](../installation/disk-image.mdx)) et par les outils qui ne prennent pas en charge JWT.

:::tip
Pour un accès scripté, privilégiez une approche API dédiée et exécutez toujours les scripts sur l'hôte OIBus lui-même
(`localhost`) afin que les identifiants ne soient pas transmis sur le réseau sans chiffrement.
:::

### Limites des authentifications échouées {#failed-authentication-limits}

Vérifier un mot de passe prend volontairement du temps et de la mémoire : OIBus limite donc les authentifications échouées,
depuis la page de connexion ou avec l'authentification Basic :

- une adresse IP peut échouer **10 fois en 15 minutes** ;
- un identifiant peut échouer **100 fois en 15 minutes**, depuis n'importe quelle adresse.

Au-delà, les authentifications de l'adresse ou de l'identifiant sont refusées avec une réponse HTTP 429 (avec un en-tête
`Retry-After`), sans vérifier le mot de passe, jusqu'à ce que 15 minutes se soient écoulées depuis leur premier échec. Les
authentifications réussies ne sont pas comptées : un client de l'API utilisant les bons identifiants n'est jamais ralenti, sauf si
son adresse ou son identifiant est bloqué. La limite plus élevée sur un identifiant arrête une tentative répartie sur de
nombreuses adresses, sans permettre à quelques-unes d'entre elles de bloquer un compte.
Les adresses de l'hôte lui-même (loopback) ne sont limitées que par identifiant, puisque tous les clients d'un proxy inverse
exécuté sur l'hôte en proviennent.

Une authentification échouée prend autant de temps, et reçoit la même réponse, que l'identifiant existe ou non : elle ne révèle
pas quels identifiants existent.

## Filtrage IP {#ip-filtering}

OIBus applique un contrôle d'accès basé sur l'IP au niveau des requêtes HTTP. Les requêtes provenant d'adresses non listées
reçoivent une réponse HTTP 401 avant toute tentative d'authentification.

Comportements clés :

| Comportement                  | Détail                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contournement localhost**   | `127.0.0.1`, `::1`, et les autres adresses de bouclage sont toujours autorisées, quelle que soit la liste de filtres.                                 |
| **Caractère générique**       | Une entrée `*` autorise toutes les adresses distantes.                                                                                                |
| **IPv4 / IPv6**               | Les deux formats sont pris en charge. Les adresses IPv6 mappées IPv4 (par ex. `::ffff:192.168.1.1`) sont gérées de manière transparente.              |
| **Correspondance de motifs**  | Les entrées prennent en charge `*` comme caractère générique (compilé en interne en expression régulière), permettant des règles de type sous-réseau. |
| **Désactiver pour les tests** | Passez `--ignore-ip-filters` à `oibus-launcher` pour contourner tous les contrôles IP sans modifier la configuration.                                 |

Voir [Filtres IP](../engine/ip-filters.mdx) pour les détails de configuration.

## Échange de secrets OIAnalytics {#oianalytics-secret-exchange}

Lorsque des secrets sont saisis ou mis à jour via OIAnalytics, ils sont chiffrés **dans le navigateur** avant
d'être transmis, en utilisant la clé publique RSA d'OIBus (RSA-OAEP, 4096 bits). Cela signifie que :

- OIAnalytics ne voit ni ne stocke jamais de secrets en clair.
- Seul OIBus, détenant la clé privée correspondante, peut les déchiffrer.
- Lorsque OIBus envoie sa configuration à OIAnalytics, tous les champs de secrets sont retirés avant
  la transmission.

La paire de clés RSA est générée lors de l'enregistrement OIAnalytics, et OIBus la remplace lui-même tous
les 90 jours, en même temps que ses jetons (voir [Jetons d'authentification](../installation/oianalytics.mdx#authentication-tokens)).
OIBus conserve la clé privée précédente, afin de pouvoir encore déchiffrer les secrets saisis via OIAnalytics
juste avant un remplacement.

Le certificat qu'OIBus présente aux serveurs OPC UA® est sélectionné dans chaque connecteur OPC UA, depuis le
[magasin de certificats](../engine/certificates.md), où sa clé privée est chiffrée comme les autres secrets (voir
[Certificat de communication](../south-connectors/opcua.mdx#communication-certificate)). Il est distinct de la paire de
clés utilisée pour l'échange de secrets OIAnalytics, et du secret qui signe les JWT.

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
