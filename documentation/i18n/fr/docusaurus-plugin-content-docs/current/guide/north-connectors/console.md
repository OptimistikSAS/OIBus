# Console

Le **connecteur North Console** affiche les noms de fichiers ou les valeurs directement dans la sortie console, ce qui
en fait un outil idéal pour le **débogage et le développement**.

## Paramètres spécifiques {#specific-settings}

| Paramètre    | Description                                                                                                                | Exemple de valeur |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| **Verbeux**    | Lorsqu'activé, affiche les données reçues dans des **tableaux détaillés**. Lorsque désactivé, affiche uniquement le **nombre de valeurs** reçues. | Activé/Désactivé   |

## Utilisation de la console en production {#using-the-console-in-production}

Dans les environnements de production où OIBus s'exécute en tant que service (Windows/Linux), suivez ces étapes pour
consulter la sortie console :

1. **Arrêtez le service OIBus** à l'aide du gestionnaire de services de votre système d'exploitation.
2. **Lancez OIBus manuellement** depuis un terminal avec des privilèges administratifs :
   - **Windows** : accédez au dossier d'installation et exécutez `go.bat`.
   - **Linux** : accédez au dossier d'installation et exécutez `go.sh`.
3. Consultez la sortie console directement dans le terminal.

:::caution Important
Après le débogage, n'oubliez pas de :

1. Quitter la session terminal.
2. **Redémarrer le service OIBus** à l'aide du gestionnaire de services de votre système d'exploitation pour reprendre
   le fonctionnement normal.

:::

## Bonnes pratiques {#best-practices}

- Utilisez le **mode verbeux** pendant le développement ou le dépannage pour inspecter la structure et le contenu des
  données.
- Ne l'utilisez pas en production afin de réduire l'encombrement de la console.
- Pour des données persistantes, envisagez d'utiliser le [connecteur North File Writer](../north-connectors/file-writer.md)
  plutôt que de vous fier uniquement à la sortie console.
