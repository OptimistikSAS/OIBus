---
displayed_sidebar: useCasesSidebar
sidebar_position: 1
---

# Cas d'usage

Les cas d'usage de cette section montrent des déploiements OIBus de bout en bout avec des schémas réseau concrets, des exemples de configuration et des conseils sur les droits d'accès, les règles de pare-feu et le réglage des connecteurs.

Chaque cas d'usage couvre une association South → North spécifique. Avant de suivre un cas d'usage, assurez-vous d'avoir lu les pages de référence du connecteur concerné, liées en haut de chaque guide.

| Cas d'usage                                                    | Connecteur South             | Connecteur North    |
| ------------------------------------------------------------- | ---------------------------- | ------------------ |
| [OPC UA → OIAnalytics](./use-case-opcua)                      | OPC UA                       | OIAnalytics        |
| [Microsoft SQL Server → Azure Blob Storage](./use-case-mssql) | MSSQL                        | Azure Blob Storage |
| [ADS / TwinCAT → OIAnalytics](./use-case-ads)                 | ADS                          | OIAnalytics        |
| [Modbus → File Writer](./use-case-modbus)                     | Modbus                       | File Writer        |
| [Aspen IP21 → Amazon S3](./use-case-ip21)                     | ODBC (via OIBus Agent)       | Amazon S3          |
| [OSIsoft PI → OIAnalytics](./use-case-pi)                     | OSIsoft PI (via OIBus Agent) | OIAnalytics        |
| [Configuration réseau avancée multi-sites](./use-case-advanced) | Multiple                     | Multiple           |

:::tip Nouveau sur OIBus ?
Commencez par le cas d'usage [OPC UA → OIAnalytics](./use-case-opcua) — il couvre le modèle de déploiement le plus courant et introduit les concepts clés utilisés dans tous les autres cas d'usage.
:::
