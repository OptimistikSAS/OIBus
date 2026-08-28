---
sidebar_position: 1
---

# Réglage des paramètres de temporisation des requêtes History pour le South

[Paramètres communs](../south-connectors/common-settings.md) présente les quatre champs de temporisation
disponibles pour les connecteurs compatibles avec l'historisation — **Intervalle de lecture maximum**,
**Délai de lecture**, **Décalage de l'heure de début**, **Décalage de l'heure de fin** — ainsi que la
**Stratégie de reprise**, et montre où ils se trouvent sur un élément ou un groupe. Cette page va un cran
plus loin : le modèle mental derrière ce que fait réellement chaque paramètre à une requête, et des
scénarios concrets pour décider _quelle valeur_ utiliser et _pourquoi_.

Ces paramètres n'existent que sur les connecteurs South ayant des capacités d'historisation (connecteurs
SQL, OPC UA en mode HA, OPC Classic en mode HDA, OSIsoft PI, OIAnalytics, REST, InfluxDB — voir la liste
complète dans [Requêtes History](../history-queries.md#compatible-south-connectors)). Les connecteurs
uniquement en streaming (MQTT, Modbus, scanners de dossier/FTP/SFTP) n'ont pas de plage temporelle à
découper, donc rien de tout cela ne s'applique à eux.

## Le modèle mental : une exécution, quatre décisions {#the-mental-model-one-run-four-decisions}

Chaque fois qu'un élément ou un groupe compatible avec l'historisation s'exécute, OIBus suit les quatre
mêmes étapes, dans l'ordre :

1. **Calculer la fenêtre effective.** Partir de l'instant suivi (la fin de la dernière requête réussie) et
   de l'heure actuelle, puis appliquer `Décalage de l'heure de début` et `Décalage de l'heure de fin` aux
   deux extrémités. Si la fin obtenue n'est pas postérieure au début obtenu, l'exécution est entièrement
   ignorée pour ce cycle — rien n'est interrogé et l'instant suivi n'avance pas.
2. **Découper en sous-intervalles.** La fenêtre effective est découpée en tranches consécutives d'au plus
   `Intervalle de lecture maximum` secondes chacune (la dernière tranche est plus courte). Une valeur de
   `0` (ou un champ laissé vide) désactive le découpage — toute la fenêtre est interrogée en un seul appel.
3. **Interroger chaque sous-intervalle dans l'ordre**, en marquant une pause de `Délai de lecture`
   millisecondes entre une sous-requête et la suivante (jamais avant la première, jamais après la
   dernière). La `Stratégie de reprise` décide si cet ordre part du plus ancien vers le plus récent (par
   défaut) ou l'inverse.
4. **Faire avancer l'instant suivi.** Avec `oldest`, il avance après _chaque_ sous-intervalle qui renvoie
   des données plus récentes que ce qui est déjà suivi — ainsi, un plantage en cours d'exécution ne perd que
   l'intervalle en cours. Avec `newest`, il n'avance qu'une fois que _tous_ les sous-intervalles sont
   terminés, de sorte qu'un redémarrage en cours d'exécution ne puisse pas sauter une tranche plus ancienne
   pas encore interrogée.

Les décalages sont appliqués une seule fois, aux deux extrémités de la fenêtre entière — jamais réappliqués
à chaque sous-intervalle produit par l'étape 2.

```
tracked instant                                                            now
|                                                                            |
Start time offset                                              End time offset
v                                                                            v
+----------------------------- effective window -----------------------------+

+---sub-interval 1---+---sub-interval 2---+---sub-interval 3---+----last-----+
                                          ^
                                Read delay pause here
```

`Décalage de l'heure de début` et `Décalage de l'heure de fin` positionnent chacun une extrémité de la
fenêtre effective — une valeur négative déplace cette extrémité plus tôt, une valeur positive la déplace
plus tard ; le diagramme ne présuppose aucune des deux directions, car cela dépend entièrement du signe
configuré. Le découpage n'intervient qu'_après_ que les deux extrémités ont été fixées : le
`sub-interval 1` commence exactement au début effectif ci-dessus, et le dernier sous-intervalle se termine
exactement à la fin effective, quelle que soit la façon dont les décalages ont déplacé ces extrémités pour y
arriver. La pause de délai de lecture illustrée ci-dessus se répète entre chaque paire consécutive de
sous-intervalles — jamais avant le premier, jamais après le dernier.

Le reste de cette page explique pourquoi vous voudriez écarter chacun de ces réglages de sa valeur par
défaut.

## Intervalle de lecture maximum : borner la taille d'une seule requête {#max-read-interval-bounding-how-much-a-single-query-asks-for}

`Intervalle de lecture maximum` existe pour protéger à la fois la source et OIBus d'une seule requête
simplement trop volumineuse — ce qui arrive dès que la source de données contient **de nombreuses valeurs**
pour la fenêtre demandée.

### Exemple : un retard de traitement important {#example-a-wide-backlog}

Supposons qu'un connecteur collecte 200 tags à 1 échantillon/seconde : 200 lignes/seconde, soit environ
720 000 lignes/heure. Si ce connecteur est arrêté pour maintenance pendant 24 heures, la fenêtre de la toute
prochaine exécution couvre l'intégralité de la coupure — sans découpage, cela représente une seule requête
demandant à la source plus de 17 millions de lignes en un seul aller-retour. Selon la source, cela peut
signifier une requête de plusieurs minutes qui verrouille une table, un délai d'expiration, une erreur de
mémoire insuffisante d'un côté ou de l'autre, ou simplement une charge utile trop volumineuse pour être
mise en mémoire tampon par le pilote du connecteur.

Régler `Intervalle de lecture maximum` sur, par exemple, `3600` (1 heure) transforme cette requête géante
unique en 24 requêtes séquentielles d'environ 720 000 lignes chacune. Chacune est suffisamment petite pour
se terminer rapidement et de manière prévisible, et — combinée à la stratégie de reprise `oldest` — chaque
heure terminée est durablement enregistrée comme point de reprise, de sorte qu'un redémarrage pendant le
rattrapage ne répète que l'heure qui était en cours, pas la journée entière.

### Le dimensionner {#sizing-it}

- **Basez-vous sur ce que la source (et le réseau) peuvent raisonnablement renvoyer en un seul appel** —
  voir [Débit de données et dimensionnement du cache](./oibus-data-rate.mdx) pour savoir comment traduire un
  nombre de lignes en estimation d'octets. Une source avec des délais d'expiration de requête stricts ou une
  mémoire serveur limitée voudra un intervalle plus petit ; une source qui gère efficacement les
  balayages de larges plages (par exemple une base de données de séries temporelles correctement indexée)
  peut en utiliser un plus grand.
- **Ne le réduisez pas simplement parce que le débit en régime stable est faible.** Le réglage doit résister
  au pire cas — le plus grand retard réaliste (une coupure de week-end, une partition réseau) — et pas
  seulement aux cycles normaux où la fenêtre est naturellement petite de toute façon.
- **`0` (pas de découpage) convient pour les sources à faible volume** où la fenêtre est toujours petite en
  pratique, mais est risqué pour tout ce qui pourrait accumuler un retard important après une interruption,
  car la toute prochaine exécution devient une requête sans limite.

:::warning Les connecteurs de type SQL doivent référencer les deux variables temporelles dans la requête
Pour les connecteurs basés sur SQL (MSSQL, MySQL/MariaDB, ODBC, OLEDB, Oracle, PostgreSQL, SQLite) et REST,
OIBus n'a aucun moyen de borner une requête par lui-même — il ne fait que substituer les variables demandées
par le texte de votre requête. `Intervalle de lecture maximum` n'a d'effet que si la requête filtre
explicitement à la fois sur `@StartTime` et `@EndTime` :

```sql
SELECT * FROM sensor_data
WHERE timestamp > @StartTime
AND timestamp <= @EndTime
```

Si `@EndTime` est absent de la requête, chaque sous-intervalle récupère quand même les données depuis
`@StartTime` sans limite supérieure — le découpage produit alors le même résultat surdimensionné et non
borné à chaque fois, au lieu d'une série de résultats plus petits. Si `@StartTime` est également absent,
chaque exécution relit simplement le même ensemble de résultats fixe.

Les connecteurs qui gèrent eux-mêmes leur lecture historique en interne — OPC UA (mode HA), OPC Classic
(mode HDA) et OSIsoft PI — n'ont pas cette contrainte : OIBus transmet directement le début et la fin du
sous-intervalle à l'appel de lecture historique propre au connecteur, donc `Intervalle de lecture maximum`
borne toujours la requête, quelle que soit la façon dont les tags sont configurés.
:::

## Délai de lecture : cadencer les sous-requêtes consécutives {#read-delay-pacing-consecutive-sub-queries}

`Délai de lecture` insère une pause entre les sous-requêtes pour qu'un grand découpage par
`Intervalle de lecture maximum` ne se transforme pas en une rafale de requêtes consécutives martelant la
source — utile pour les API à débit limité (REST, OIAnalytics), les bases de données de production qui ne
doivent pas être monopolisées, ou les serveurs API/historian qui ont besoin d'un instant pour traiter la
requête précédente avant que la suivante n'arrive.

### L'interaction avec Intervalle de lecture maximum {#the-interaction-with-max-read-interval}

Les deux réglages s'équilibrent directement. Le surcoût total de cadencement pour une exécution est
approximativement :

```
overhead ≈ (number of sub-intervals − 1) × Read delay
```

Un retard de 24 heures découpé en 24 tranches d'une heure avec un `Délai de lecture` d'1 seconde ajoute
environ 23 secondes de pause totale — négligeable. Mais le même retard de 24 heures découpé en tranches
d'une minute (1 440 sous-intervalles) avec le même délai d'1 seconde ajoute près de **24 minutes** de pur
cadencement, en plus des 1 440 allers-retours eux-mêmes. Si vous réduisez `Intervalle de lecture maximum`
pour diminuer la charge par requête, vérifiez l'effet sur le temps de rattrapage pour un retard réaliste
avant de supposer qu'un petit `Délai de lecture` est anodin.

### Le dimensionner {#sizing-it-1}

| Symptôme                                                                          | Ajustement                                                                       |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| La source rejette les requêtes, limite le débit, ou se dégrade sous interrogation répétée | Augmenter `Délai de lecture`                                                      |
| Le rattrapage d'un retard important prend bien plus de temps que le retard lui-même | Diminuer `Délai de lecture` et/ou augmenter `Intervalle de lecture maximum`       |
| La source n'a aucune contrainte de débit (base de données locale sur fichier, etc.) | `0` convient                                                                       |

## Décalage de l'heure de début/fin : quand la source n'a pas fini d'écrire {#startend-time-offset-when-the-source-isnt-done-writing-yet}

C'est le réglage qui compte le plus lorsque **plusieurs éléments interrogés ensemble ne sont pas tous
digérés par la source de données au même moment**.

### Pourquoi cela se produit {#why-this-happens}

De nombreuses sources de type historian ne rendent pas une valeur durablement interrogeable dès qu'elle est
horodatée. Une table SQL peut valider les insertions par lots périodiques ; un serveur OPC UA HA met
généralement en mémoire tampon localement les échantillons nouvellement historisés avant de les transférer
vers son stockage sous-jacent ; un serveur PI ou OPC Classic HDA résout une lecture multi-tags en interne,
un tag à la fois. Ce dernier cas est le scénario concret de « plusieurs éléments ensemble » : une même
requête groupée pour un ensemble d'éléments peut voir la valeur du tag A déjà transférée et interrogeable,
alors que la valeur du tag B pour ce même instant est encore dans une mémoire tampon interne quelques
centaines de millisecondes en retard — parce que le groupe est interrogé en un seul appel partageant un
seul instant suivi, cette incohérence n'est pas visible élément par élément.

Si OIBus interroge `[instant suivi, maintenant]` et fait immédiatement avancer l'instant suivi à
`maintenant`, toute valeur qui n'avait pas encore été digérée par la source au moment de la requête est
perdue définitivement — l'exécution suivante démarre strictement après elle et ne demandera plus jamais
cette tranche de temps.

### Décalage de l'heure de début : redemander une marge de sécurité {#start-time-offset-re-request-a-safety-cushion}

Un `Décalage de l'heure de début` **négatif** (par exemple `-2000` pour une marge de 2 secondes) déplace le
début de la fenêtre vers l'arrière, de sorte qu'OIBus redemande une tranche de temps déjà couverte lors de
l'exécution précédente. Toute valeur qui n'avait pas encore été digérée la dernière fois a une seconde
chance d'apparaître cette fois-ci. Cela suppose que la requête (ou une étape de déduplication en aval)
tolère qu'une ligne déjà vue soit renvoyée à nouveau — ce qui est vrai pour la plupart des requêtes SQL
indexées par horodatage et pour le traitement côté North des horodatages en double.

Dimensionnez le décalage négatif un peu plus large que le retard de validation/transfert connu ou observé de
la source. Si vous ne connaissez pas ce retard, commencez prudemment (par exemple `-5000`) et affinez une
fois que vous avez confirmé qu'aucun trou n'apparaît à la frontière.

### Décalage de l'heure de fin : ne pas toucher du tout à la zone floue {#end-time-offset-dont-touch-the-fuzzy-region-at-all}

Un `Décalage de l'heure de fin` **négatif** adopte l'approche inverse : au lieu de redemander une marge la
fois suivante, il fait reculer la fin de _cette_ fenêtre pour que la bordure finale pas encore fiable ne
soit jamais interrogée en premier lieu. Cela convient aux sources à cohérence éventuelle où redemander n'est
pas sûr ou pratique — par exemple, une API adossée à une vue matérialisée qui ne se rafraîchit que toutes
les quelques secondes, où demander des données « à l'instant présent » peut renvoyer un résultat partiel ou
susceptible de changer.

Le compromis par rapport à `Décalage de l'heure de début` concerne vraiment la réactivité, pas la perte de
données — aucune des deux approches ne perd réellement de valeurs. `Décalage de l'heure de début` duplique
des valeurs déjà interrogées, mais en échange une valeur en retard est récupérée dès que possible, dès
l'exécution suivante après qu'elle devient disponible, puisque cette exécution redemande la même tranche
finale. `Décalage de l'heure de fin` ne duplique jamais une valeur, mais retarde chaque valeur de la région
finale réduite d'au moins une exécution : puisque l'instant suivi n'avance jamais au-delà de la fin réduite,
cette région devient simplement une partie de la fenêtre de l'exécution _suivante_ au lieu d'être interrogée
maintenant.

### Exemple : un retard de validation de 2 secondes, visualisé {#example-a-2-second-commit-lag-visualized}

Exemple simplifié : une source valide les valeurs 2 secondes après leur horodatage, et un mode de scan
l'interroge toutes les 5 secondes — un ratio exagéré, uniquement pour rendre le motif visible. Chaque fenêtre
d'exécution se termine 2 secondes dans des données que la source n'a pas encore validées : cette tranche
finale (marquée `███` ci-dessous) est la « zone à risque ». Ce qui diffère entre les trois approches, c'est
la façon dont chacune la traite.

```
No offset — the risky zone is dropped, every single run
  run @:15   [:10 ─────────── :13 ███ :15)        tracked instant → :15
  run @:20   [:15 ─────────── :18 ███ :20)        tracked instant → :20   (:13-:14 never revisited — LOST)
  run @:25   [:20 ─────────── :23 ███ :25)        tracked instant → :25   (:18-:19 never revisited — LOST)

Start time offset = -2s — the risky zone is re-asked and recovered, but duplicated
  run @:15   [:08 ▒▒▒ :10 ─────────── :13 ███ :15)   tracked instant → :15
  run @:20   [:13 ▒▒▒ :15 ─────────── :18 ███ :20)   :13-:14 now committed → RECOVERED (re-read, duplicate)
  run @:25   [:18 ▒▒▒ :20 ─────────── :23 ███ :25)   :18-:19 RECOVERED the same way — repeats every run

End time offset = -2s — the risky zone is never queried, just deferred
  run @:15   [:10 ─────────── :13)                   tracked instant → :13   (window never reaches :13-:14)
  run @:20               [:13 ─────────── :18)       :13-:14 collected here — one run later, never duplicated
  run @:25                           [:18 ─────────── :23)   :18-:19 collected here — same one-run delay, repeats
```

`███` = demandé par la fenêtre mais pas encore validé par la source, donc la requête ne renvoie
silencieusement rien pour cette tranche. `▒▒▒` = une tranche qui était `███` lors de l'exécution précédente,
redemandée maintenant que la source a rattrapé son retard.

Sans décalage, chaque exécution perd définitivement ses propres 2 dernières secondes. `Décalage de l'heure
de début` échange une lecture en double anodine contre la récupération de ces mêmes 2 secondes une exécution
plus tard. `Décalage de l'heure de fin` ne duplique jamais rien, mais le prix à payer est que tout ce qui se
trouve dans les 2 dernières secondes de « maintenant » arrive toujours avec une exécution complète de
retard.

Le même schéma s'applique à une requête groupée par lots, simplement selon un axe différent. Au lieu d'une
source en retard d'une durée fixe, imaginez les éléments A et B lus ensemble à chaque cycle (`:15`, `:20`,
`:25`, ...) : la valeur de l'élément A pour `:15` peut déjà être stockée au moment où le groupe est
interrogé, tandis que la valeur de l'élément B pour ce même échantillon `:15` est écrite un instant plus
tard — donc la zone à risque est la frontière du cycle elle-même, pour quel que soit l'élément qui n'a pas
encore rattrapé son retard, plutôt qu'une tranche de temps finale fixe. Les trois mêmes résultats
s'appliquent toujours : sans décalage, l'échantillon `:15` de l'élément B est silencieusement perdu pour
toujours dès que l'instant suivi avance au-delà ; un `Décalage de l'heure de début` négatif redemande la
frontière `:15` au cycle suivant et récupère la valeur de l'élément B (au prix d'une lecture en double
anodine de celle de l'élément A, qui était déjà là) ; un `Décalage de l'heure de fin` négatif ne demande
simplement jamais un cycle avant l'exécution suivante, moment auquel chaque élément du groupe est censé
avoir rattrapé son retard.

### Choisir entre les deux {#choosing-between-them}

| Situation                                                                                          | Utiliser                                          |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| La source valide occasionnellement une valeur avec un léger retard ; les lectures en double sont anodines | `Décalage de l'heure de début` négatif             |
| Les données les plus récentes de la source sont peu fiables/partielles jusqu'à stabilisation ; redemander n'est pas souhaitable | `Décalage de l'heure de fin` négatif               |
| Une requête multi-éléments groupée (OPC UA HA, PI, HDA) où les éléments ne se transfèrent pas tous en même temps | `Décalage de l'heure de fin` négatif sur le groupe |
| L'horloge d'OIBus est en retard par rapport à celle de la source de données                          | `Décalage de l'heure de fin` positif                |

Un `Décalage de l'heure de fin` positif est surtout utile pour l'**alignement d'horloge** : si l'horloge
propre d'OIBus est en retard par rapport à celle de la source de données d'un écart connu approximativement,
la source peut déjà avoir des données horodatées plus tard que ce qu'OIBus considère comme « maintenant ».
Avancer la borne supérieure de la requête de ce même décalage permet à OIBus de récupérer les données jusqu'à
l'heure actuelle réelle de la source, au lieu de s'arrêter trop tôt à sa propre horloge en retard.

## Stratégie de reprise : ordre et durabilité pendant le rattrapage {#recovery-strategy-order-and-durability-during-catch-up}

`Stratégie de reprise` n'a d'importance qu'à partir du moment où il y a plus d'un sous-intervalle à traiter
— c'est-à-dire chaque fois qu'un retard (première exécution, interruption, un `Décalage de l'heure de
début` élargi) produit plusieurs tranches en un seul cycle.

- **`Du plus ancien au plus récent` (par défaut)** traite le retard de manière chronologique et enregistre
  l'instant suivi comme point de reprise après chaque tranche. Un plantage ou un redémarrage en cours de
  rattrapage ne réinterroge que la seule tranche en cours. Les tableaux de bord restent en retard sur la
  réalité jusqu'à ce que l'ensemble du retard soit résorbé.
- **`Du plus récent au plus ancien`** interroge d'abord la tranche la plus récente, afin que les valeurs
  actuelles soient disponibles immédiatement, puis rattrape les tranches plus anciennes ensuite. L'instant
  suivi n'avance qu'une fois que l'_intégralité_ du retard pour cette exécution est terminée — un
  redémarrage en cours d'exécution réinterroge tout le retard au lieu de reprendre en cours de route,
  sacrifiant la sécurité en cas de plantage pour une visibilité plus rapide du « maintenant ».

Choisissez `newest` lorsqu'un tableau de bord ou un consommateur en aval a besoin des valeurs actuelles dès
que possible, même pendant qu'un rattrapage historique important est encore en cours. Conservez `oldest`
(par défaut) lorsque la progression incrémentale et sécurisée en cas de plantage compte plus que la vitesse
d'apparition du « maintenant » — ce qui est le bon choix pour la plupart des installations non supervisées.

## Assembler le tout : un exemple concret {#putting-it-together-a-worked-example}

Un connecteur South MSSQL interroge 200 tags depuis une table historian. La base de données valide les
insertions par lots et effectue généralement la validation dans un délai de 1,5 seconde après l'horodatage
de l'échantillon. L'équipe souhaite que les tableaux de bord affichent rapidement les valeurs actuelles même
après une fenêtre de maintenance, tout en garantissant une progression sécurisée en cas de plantage si un
rattrapage est interrompu.

| Réglage                       | Valeur                          | Justification                                                                                                                      |
| ------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Intervalle de lecture maximum** | `900`                          | Des tranches de 15 minutes maintiennent le nombre de lignes de chaque requête (~180 000 lignes à ce débit) confortablement dans le budget de temps de réponse de la source. |
| **Délai de lecture**           | `500`                            | Un cadencement suffisant pour éviter de concurrencer le trafic de production sur la même base de données, sans ralentir significativement un rattrapage de plusieurs heures. |
| **Décalage de l'heure de début** | `-2000`                        | Une marge de 2 secondes, confortablement au-dessus du retard de validation observé de 1,5 seconde.                              |
| **Stratégie de reprise**       | `Du plus ancien au plus récent` | La sécurité en cas de plantage a été privilégiée par rapport à la visibilité immédiate de « maintenant » pour ce connecteur.     |

Si la même équipe avait plutôt besoin que le tableau de bord en direct reflète les valeurs actuelles
immédiatement pendant un long rattrapage suite à une coupure de week-end — en acceptant qu'un redémarrage en
cours de rattrapage réexécute l'intégralité du retard — elle basculerait `Stratégie de reprise` sur
`Du plus récent au plus ancien` et laisserait les trois autres valeurs telles quelles.

## Pièges courants {#common-pitfalls}

- **`Intervalle de lecture maximum` trop grand pour la source.** La toute prochaine exécution après un
  véritable retard devient une requête surdimensionnée — exactement le problème que ce réglage est censé
  éviter.
- **`Intervalle de lecture maximum` trop petit pour le retard réellement constaté.** Transforme un problème
  de volume de données en un problème de nombre d'intervalles : des milliers de petites sous-requêtes,
  chacune payant l'intégralité de la pause de `Délai de lecture`. Vérifiez la formule de surcoût ci-dessus
  par rapport à votre pire cas de retard, pas seulement au régime stable.
- **Oublier que les décalages s'appliquent une seule fois à toute la fenêtre, pas par sous-intervalle.** Le
  découpage par `Intervalle de lecture maximum` intervient _après_ l'application des décalages au début/à la
  fin effectifs — une frontière de sous-intervalle au milieu d'une fenêtre découpée n'est jamais décalée
  indépendamment.
- **Un `Décalage de l'heure de fin` qui est systématiquement plus grand que l'intervalle de scrutation.** Si
  le mode de scan se déclenche plus souvent que le décalage ne réduit la fenêtre, certaines exécutions
  calculent une fin qui n'est pas postérieure au début et sont entièrement ignorées — visible comme une
  exécution qui enregistre une requête ignorée sans donnée collectée.
- **Modifier ces réglages sur un connecteur ayant un instant suivi déjà établi.** La toute prochaine
  exécution applique les nouvelles valeurs en partant de l'instant suivi actuel ; un grand saut dans
  `Intervalle de lecture maximum` ou l'un des deux décalages peut produire un petit trou ou un doublon à
  cette frontière. Voir
  [Paramètres communs — Suivi de l'instant maximum](../south-connectors/common-settings.md#max-instant-tracking)
  pour la vue d'ensemble du comportement de l'instant suivi à travers les changements de configuration.

## Aide-mémoire {#quick-reference}

| Objectif / symptôme                                                                        | Ajuster                                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| La source expire ou manque de mémoire sur les requêtes larges                                 | Réduire `Intervalle de lecture maximum`                      |
| Le rattrapage d'un retard important est dominé par les pauses, pas par les requêtes elles-mêmes | Augmenter `Intervalle de lecture maximum` et/ou réduire `Délai de lecture` |
| La source limite le débit, se dégrade ou renvoie des erreurs sous interrogation répétée       | Augmenter `Délai de lecture`                                  |
| Besoin de récupérer les valeurs arrivant en retard dès qu'elles existent, les doublons sont acceptables | `Décalage de l'heure de début` négatif                        |
| Il faut éviter les lectures en double, on peut attendre l'exécution suivante pour les valeurs déjà disponibles | `Décalage de l'heure de fin` négatif                          |
| Les tableaux de bord doivent afficher les valeurs actuelles rapidement pendant un long rattrapage | `Stratégie de reprise` → `newest`                             |
| Le rattrapage doit être sécurisé en cas de plantage avec un minimum de travail répété          | `Stratégie de reprise` → `oldest` (par défaut)                |
