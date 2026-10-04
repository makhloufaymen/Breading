# Breading — mise en relation pour la reproduction d'animaux

Application mobile façon « site de rencontre » pour animaux. Les utilisateurs sont les propriétaires ; chacun peut avoir plusieurs animaux et cherche un partenaire compatible pour l'un d'eux.

Le développeur est expérimenté en Java/Angular mais découvre Ionic, Capacitor et Supabase : signaler les différences avec une app Angular web classique et justifier les choix côté Supabase.

## Stack

- **Angular 22** (zoneless, sans zone.js) + **Ionic 9** — standalone components, signals, TypeScript `strict`
- **Capacitor 8** — Android et iOS. Développement sous Windows, sans Mac : Android est testé en local ; le projet `ios/` est maintenu synchronisé et compilé plus tard sur un Mac de CI (Codemagic ou GitHub Actions macOS).
- App id : `com.breading.app` (modifiable tant que l'app n'est pas publiée)
- **Supabase** — Auth (email + mot de passe), Postgres + PostGIS, Storage (photos), Realtime (messagerie)
- **Supabase en local** via la CLI (Docker Desktop) ; migrations versionnées dans `supabase/migrations`
- Géocodage code postal → commune : API publique `geo.api.gouv.fr` (France uniquement)

## Périmètre V1

Inclus : inscription/connexion, plusieurs animaux par propriétaire, fiche animal (espèce, race, sexe, date de naissance, photos, pedigree, vaccins, description, localisation), découverte façon Tinder avec filtres, like/pass, match réciproque, liste « qui a liké mon animal », annulation de match, messagerie temps réel, signalement et blocage, suppression de compte.

Hors périmètre : paiement, notifications push, back-office, i18n, vérification du pedigree, âge minimum.

## Règles métier

- **Espèces : chiens et chats uniquement.**
- **Race** : choisie dans une liste par espèce, ou saisie libre (« autre race ») si absente. Jamais les deux.
- **Pedigree** : oui/non + registre (LOF, LOOF…) + numéro. Déclaratif, aucune vérification.
- **Vaccins** : liste prédéfinie par espèce (table `vaccines`), avec date d'administration et date d'expiration facultative.
- **Localisation** : code postal + ville saisis par l'utilisateur ; on stocke le centre de la commune (pas de GPS).
- **Découverte** : se fait toujours au nom d'un de mes animaux. Espèce identique et sexe opposé imposés ; filtres : race, âge, distance. Exclut mes animaux, les animaux déjà swipés et les propriétaires bloqués (dans les deux sens).
- **Compatibilité** : même espèce, sexes opposés, propriétaires différents, les deux animaux actifs.
- **Match** : créé uniquement par un trigger Postgres lors d'un like réciproque compatible. Le client n'écrit jamais dans `matches`.
- **Annulation de match** : supprime le match et toute la conversation (cascade). Les swipes sont conservés pour que les animaux ne se reproposent pas.
- **Qui m'a liké** : un propriétaire voit les likes reçus par ses animaux.
- **Blocage** : masque l'autre propriétaire partout (découverte, likes reçus) et supprime les matchs existants entre eux.
- **Suppression de compte** : depuis l'app (exigence des stores). Supprime toutes les données et les photos en Storage (Edge Function avec la clé `service_role`).

## Architecture

```
src/app/
  app.config.ts  providers globaux (Ionic, router, initialisations)
  core/        singletons sans UI : supabase/ (client, adaptateur de stockage, database.types.ts généré),
               auth/ (store, guards), theme/ (ThemeStore), models/
  layout/      coquille de navigation (tabs)
  features/    auth, pets, discover, matches, chat, account
               chaque feature : data/ (repository), state/ (store signals), pages/, components/
  shared/      ui/ (composants sur mesure : empty-state, pet-card, swipe-deck, photo-carousel…), pipes/
src/theme/     variables.scss : tous les tokens (couleurs clair + sombre, rayons, espacements, animations)
src/global.scss  imports Ionic, police, styles globaux des composants Ionic
android/, ios/ projets natifs générés par Capacitor (versionnés ; modifiés seulement pour permissions/config)
supabase/      config.toml, migrations/, seed.sql, functions/ (Edge Functions)
```

- **Routing** : `/login`, `/register` publics ; `/tabs` protégé par `authGuard` avec les onglets `discover`, `matches`, `pets`, `account`. Toutes les routes en `loadComponent`. Filtres, « C'est un match ! » et formulaires rapides en modales Ionic.
- **État** : un store `@Injectable` par feature. Signals privés, `computed` publics en lecture seule, méthodes `async`. Pas de NgRx. RxJS seulement pour le flux Realtime.
- **Accès aux données** : seuls les repositories importent le client Supabase — dans `features/*/data/`, ou dans `core/<domaine>/` pour les données partagées par plusieurs features (`core/profile`, `core/reference`). Les référentiels (espèces, races, vaccins) se lisent via `ReferenceStore.ensureLoaded()`, chargés une fois par session. CRUD simple via `supabase.from(...)` ; logique métier via des RPC Postgres.

## Schéma (résumé)

`profiles`, `species`, `breeds`, `vaccines`, `pets` (avec `breed_id` ou `breed_other`, `postal_code`, `city`, `location geography(Point,4326)`), `pet_photos`, `pet_vaccinations`, `swipes` (`swiper_pet_id`, `target_pet_id`, `kind` like/pass), `matches` (paire canonique `pet_a_id < pet_b_id`), `messages` (référence `match_id` ; un match = une conversation), `blocks`, `reports`.

RPC : `search_pets`, `unmatch`, `block_owner`, `mark_messages_read`, `set_pet_vaccinations` (remplace la liste des vaccins d'un animal en une transaction), `reorder_pet_photos` (la première photo devient la principale). Fonctions utilitaires `is_pet_owner`, `is_match_participant`, `are_compatible` en `security definer`.

Storage : bucket public `pet-photos` (JPEG uniquement, 2 Mo max), chemins `{owner_id}/{pet_id}/{uuid}.jpg`, écriture limitée au dossier `auth.uid()` et aux animaux de l'utilisateur. 6 photos max par animal ; `pet_photos.position` 0 = photo principale. Les fichiers ne sont pas supprimés par les cascades SQL : le client les supprime (photo retirée, animal supprimé).

## Conventions

- **Code, noms, commentaires et commits en anglais ; interface en français codé en dur.**
- RLS activé sur **toutes** les tables : c'est la seule couche de sécurité. Dans les politiques, écrire `(select auth.uid())`, pas `auth.uid()`.
- Toute modification du schéma passe par une nouvelle migration (`supabase migration new <name>`), jamais par le dashboard. Appliquer avec `supabase migration up --local`, puis régénérer les types : `npm run gen:types`.
- Toute nouvelle table : RLS activé + politiques + `revoke`/`grant` par colonne si le client ne doit modifier que certaines colonnes. Vérifier les politiques avec un script qui joue deux utilisateurs (lecture/écriture croisées).
- Ionic 9 : les composants standalone s'importent directement depuis `@ionic/angular` (`IonButton`, `IonList`…). Pas d'`IonicModule`. Les icônes s'enregistrent avec `addIcons()`.
- Angular zoneless : l'état d'affichage passe par des signals (pas de mutation d'objets simples en espérant une détection de changements). Composants en `ChangeDetectionStrategy.OnPush` pour les composants de `shared/ui`.
- Styles : aucune couleur en dur dans les composants, seulement des `var(--ion-…)` / `var(--app-…)`.
- Pages dans un `ion-router-outlet` : elles restent en mémoire. Rafraîchir dans `ionViewWillEnter` et fermer les abonnements Realtime dans `ionViewWillLeave`.
- Session Supabase persistée via `@capacitor/preferences` (pas de `localStorage`).
- Photos redimensionnées et privées de leurs métadonnées EXIF avant l'upload.
- Formulaires : Reactive Forms typés.
- Un commit par étape validée dans le navigateur (`ionic serve`, vue mobile des DevTools).

## Design

- Style **familial, chaleureux, doux pour les yeux et animé** : tons crème et pastel chauds, coins très arrondis, ombres légères, illustrations et emojis d'animaux pour les états vides.
- Mode Ionic forcé à **`ios`** sur les deux plateformes (`provideIonicAngular({ mode: 'ios' })`) pour une apparence identique.
- Police arrondie (Nunito), embarquée dans l'app via `@fontsource`, pas de CDN.
- Toutes les couleurs, rayons et espacements sont des variables CSS dans `src/theme/variables.scss`. Palette claire : fond crème `#fff9f3`, texte brun `#3e2e25`, primaire pêche `#f4a07a` (texte foncé dessus, pas blanc), secondaire sauge, tertiaire lavande. Mode sombre : brun-gris chaud `#211a16`, jamais noir pur. Le choix Auto / Clair / Sombre est géré par `ThemeStore` (classes `theme-light` / `theme-dark` sur `<html>`).
- Animations : swipe des cartes avec la Gesture API d'Ionic, transitions douces, micro-animations sur le like et le match. Respecter `prefers-reduced-motion`.
- Composants Ionic pour la navigation, les modales et les listes ; composants sur mesure pour les fiches animaux et la pile de cartes.

## Commandes

```bash
ionic serve                                 # navigateur, http://localhost:8100
npm run build && npx ng lint && npx ng test --watch=false
ionic cap run android -l --external         # live reload sur téléphone Android
npx cap sync                                # après un build ou l'ajout d'un plugin
supabase start | stop                       # Supabase local (Docker)
supabase db reset                           # rejoue migrations + seed
```

Prérequis Windows : Node 22+, Ionic CLI, Android Studio (SDK + JDK 21 intégré), Docker Desktop (démarré), Supabase CLI. Machine à 8 Go de RAM : services Supabase non indispensables désactivés dans `supabase/config.toml` (analytics, SMTP local, edge runtime, S3, vector) ; un seul émulateur à la fois.

Pas de téléphone physique pour l'instant : les étapes se valident **dans le navigateur** (`ionic serve` sur http://localhost:8100, vue mobile des DevTools). L'émulateur Android (AVD `Medium_Phone_API_37.0`) reste disponible pour vérifier le natif (caméra, build) : depuis l'émulateur, le Supabase local est joignable via `http://10.0.2.2:54321`, pas `localhost`. Pour les scénarios à deux utilisateurs (match, chat) : deux fenêtres de navigateur (dont une en navigation privée).

## Plan par étapes

Statut : `[ ]` à faire, `[x]` validé dans le navigateur et commité.

- [x] 0. Initialisation : git, projet Ionic, Capacitor Android, thème clair/sombre, coquille à 4 onglets, Supabase local
- [x] 1. Auth : inscription, connexion, déconnexion, persistance de session, guards, `profiles` (confirmation d'email désactivée en local)
- [x] 2. Référentiels (espèces, races, vaccins) + écran Compte
- [x] 3. Mes animaux : CRUD, race en liste ou saisie libre, pedigree, vaccins, code postal → commune
- [x] 4. Photos : caméra/galerie, compression, upload, ordre, suppression
- [ ] 5. Découverte : `search_pets`, choix de l'animal qui cherche, filtres, pile de cartes à swiper, fiche détaillée
- [ ] 6. Likes et matchs : swipes, trigger de match, modale « C'est un match ! », onglet Matchs, « qui m'a liké », annulation de match
- [ ] 7. Messagerie temps réel : conversations, chat, non-lus
- [ ] 8. Confiance et conformité : signalement, blocage, suppression de compte, confirmation d'email avec deep link
- [ ] 9. Finition : états vides, erreurs, hors ligne, icône, splash, build Android signé
