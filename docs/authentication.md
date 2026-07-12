# Authentification et roles

Cette phase met en place l'authentification Digital CIP avec Supabase Auth.

## Roles

- `operator` : acces a `/operator/dashboard`
- `engineer` : acces a `/engineer/dashboard` et aux pages operateur
- `admin` : acces a `/admin/dashboard`, aux pages ingenieur et operateur

## Profil

La table `profiles` reste liee a `auth.users`. La migration de phase Auth ajoute de maniere non destructive :

- `admin` dans l'enum `app_role`
- `username`
- `rfid_badge_id`
- `is_admin()`

## Securite

- Le frontend utilise uniquement `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` reste reserve au backend.
- Les routes protegees passent par `middleware.ts`.
- Les comptes inactifs sont rediriges vers `/inactive`.
- Les acces hors role sont rediriges vers `/unauthorized`.

## Pages creees

- `/login`
- `/forgot-password`
- `/reset-password`
- `/operator/dashboard`
- `/engineer/dashboard`
- `/admin/dashboard`
- `/inactive`
- `/unauthorized`

## Validation locale

Commandes executees dans l'environnement Codex :

- `node scripts/validate-auth-phase.mjs`
- `node --test scripts/auth-phase.test.mjs`
- `python3 -m compileall apps/api/app`

Le vrai `next build` necessite l'installation des dependances npm (`next`, `react`,
`@supabase/ssr`, etc.). Dans l'environnement Codex actuel, l'acces au registre npm
est bloque, donc ce build complet doit etre relance des que les dependances sont
installees.
