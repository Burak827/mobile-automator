# Mobile Automator (App Store Connect + Google Play)

CLI and web control plane for translating and syncing store listing text with OpenAI for:
- App Store Connect (name, subtitle, description, promotional text, what's new, keywords)
- Google Play Console (title, short description, full description)

## Web Control Plane

Run:

```bash
npm run web
```

Default URL: `http://localhost:8787`
`npm run web` builds and serves the UI.

Fast development mode (single command):

```bash
npm run dev
```

This starts both API (`web:api`) and React Vite dev server (`web:ui:dev`).
Open UI from Vite at `http://localhost:5173`.

Health check:

```bash
curl http://localhost:8787/api/health
```

Run API-only when needed:

```bash
npm run web:api
```

UI development (React + Vite):

```bash
npm run web:ui:dev
```

Run API backend in a second terminal during UI development:

```bash
npm run web:api
```

### Web Features

- Persistent app configs in SQLite (`WEB_DB_PATH`)
- Locale matrix for both stores (ASC/Android) in API
- Naming/metadata overrides per locale (`App Store name`, `App Store keywords`, `Play title`, `iOS bundle display name`)
- Store rules and limits via `/api/meta`
- iOS name consistency checks and `InfoPlist.strings` generation helper
- API connectivity tests for ASC and Google Play
- Remote snapshot + workload analysis (especially for large Play locale sets)
- Locale sync: pulls from App Store + Play and writes locales/details to SQLite
- Locale details browsing for all synced locales
- Queue-based change management: all changes are queued first, then committed via "Guncelle" button
- AI translation: generate translations for all locales using OpenAI (Gen iOS / Gen Play buttons)
- Cross-store copy: copy locale data from iOS to Play Store or Play Store to iOS
- Apple CFBundleList JSON download for `InfoPlist.strings` generation
- Locale add/remove/update: manage locale set and apply field-level updates per locale

### Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/meta` | Store rules, field limits, locale catalog |
| `GET` | `/api/apps` | List all apps |
| `POST` | `/api/apps` | Create a new app |
| `GET` | `/api/apps/:id` | Get app details |
| `PUT` | `/api/apps/:id` | Update app config |
| `DELETE` | `/api/apps/:id` | Delete an app |
| `GET` | `/api/apps/:id/locales` | Configured locale matrix |
| `POST` | `/api/apps/:id/locales/sync` | Sync locales from remote stores |
| `POST` | `/api/apps/:id/locales/apply` | Add/remove/update locale details |
| `GET` | `/api/apps/:id/locales/details` | All synced locale details |
| `GET` | `/api/apps/:id/locales/details/:store/:locale` | Single locale detail |
| `POST` | `/api/apps/:id/generate-translations` | AI translate via NDJSON streaming |
| `POST` | `/api/apps/:id/copy-cross-store` | Copy data between iOS and Play stores |
| `GET` | `/api/apps/:id/apple-cfbundle-list` | Download CFBundleList JSON |

#### Locale Sync

```bash
curl -X POST http://localhost:8787/api/apps/1/locales/sync \
  -H "Content-Type: application/json" \
  -d '{"storeScope":"both"}'
```

#### AI Translation (NDJSON Streaming)

```bash
curl -N http://localhost:8787/api/apps/1/generate-translations?store=app_store \
  -X POST
```

Returns newline-delimited JSON events: `start`, `progress`, `locale_done`, `locale_skip`, `error`, `done`.

Build with static web assets:

```bash
npm run web:build
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the env template and fill values:

```bash
cp .env.example .env
```

### Shared Required Env Vars

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Optional shared var:
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)

### Web Env Vars

- `WEB_PORT` (default: `8787`)
- `WEB_DB_PATH` (default: `./data/mobile-automator.sqlite`)
- `WEB_ENABLE_UI` (default: `false`; set `true` to serve `src/web/public`)

### App Store Connect Env Vars

Required for ASC commands:
- `ASC_ISSUER_ID`
- `ASC_KEY_ID`
- `ASC_PRIVATE_KEY_PATH`

Optional:
- `ASC_APP_ID`
- `ASC_VERSION_ID`
- `ASC_PLATFORM` (default: `IOS`)
- `ASC_SOURCE_LOCALE` (default: `en-US`)
- `ASC_TARGET_LOCALES` (comma-separated)
- `ASC_SYNC_FIELDS` (comma-separated: `description,promotionalText,whatsNew,keywords`)
- `ASC_LIMIT_DESCRIPTION` (default: `4000`, set `0` to disable)
- `ASC_LIMIT_PROMOTIONAL_TEXT` (default: `170`, set `0` to disable)
- `ASC_LIMIT_WHATS_NEW` (default: `4000`, set `0` to disable)
- `ASC_LIMIT_KEYWORDS` (default: `100`, set `0` to disable)
- `ASC_STRICT_LIMITS` (`true/false`)
- `ASC_BASE_URL` (default: `https://api.appstoreconnect.apple.com`)

### Google Play Env Vars

Required for GPC commands:
- `GPC_SERVICE_ACCOUNT_KEY_PATH`
- `GPC_PACKAGE_NAME` (or pass `--package-name`)

Optional:
- `GPC_SOURCE_LOCALE` (default: `en-US`)
- `GPC_TARGET_LOCALES` (comma-separated)
- `GPC_SYNC_FIELDS` (comma-separated: `title,shortDescription,fullDescription`)
- `GPC_LIMIT_TITLE` (default: `30`, set `0` to disable)
- `GPC_LIMIT_SHORT_DESCRIPTION` (default: `80`, set `0` to disable)
- `GPC_LIMIT_FULL_DESCRIPTION` (default: `4000`, set `0` to disable)
- `GPC_STRICT_LIMITS` (`true/false`)

`GPC_SERVICE_ACCOUNT_KEY_PATH` should be a local path to your JSON key file, for example:

```env
GPC_SERVICE_ACCOUNT_KEY_PATH=/Users/you/Downloads/my-service-account.json
```

### Google Play Access Checklist

Before using `gpc-*` commands:

1. Enable Google Play Developer API in your Google Cloud project.
2. Create a service account and JSON key.
3. In Play Console, add that service account email in Users & permissions and grant app permissions for store listing management.

## CLI Commands

`npm run dev` keeps CLI compatibility when arguments are passed:

```bash
npm run dev -- <cli-command> [options]
```

### App Store Connect

List versions for an app:

```bash
npm run dev -- list-versions --app-id <APP_ID>
```

List localizations for a version:

```bash
npm run dev -- list-localizations --version-id <VERSION_ID>
```

Sync fields from English to specific locales:

```bash
npm run dev -- sync \
  --version-id <VERSION_ID> \
  --source-locale en-US \
  --target-locales tr-TR,fr-FR
```

Sync fields for all existing locales (except source):

```bash
npm run dev -- sync --version-id <VERSION_ID>
```

Resolve version by version string:

```bash
npm run dev -- sync \
  --app-id <APP_ID> \
  --version-string 1.2.3 \
  --target-locales tr-TR
```

Dry run (no updates):

```bash
npm run dev -- sync --version-id <VERSION_ID> --dry-run
```

Use latest version automatically (highest `createdDate`/`versionString`):

```bash
npm run dev -- sync --app-id <APP_ID> --target-locales tr-TR
```

Prompt before each locale + throttle requests:

```bash
npm run dev -- sync \
  --app-id <APP_ID> \
  --fields promotionalText,whatsNew,keywords \
  --confirm-each-locale \
  --delay-ms 1200 \
  --max-retries 5 \
  --retry-base-ms 1000
```

Sync only specific fields:

```bash
npm run dev -- sync \
  --version-id <VERSION_ID> \
  --fields description,promotionalText,keywords
```

Use a local keywords source file:

```bash
npm run dev -- sync \
  --version-id <VERSION_ID> \
  --fields keywords \
  --source-keywords-file ./sources/keywords.txt
```

Preview translated text:

```bash
npm run dev -- sync --version-id <VERSION_ID> --preview
```

Override length limits (set `0` to disable):

```bash
npm run dev -- sync \
  --version-id <VERSION_ID> \
  --limit-promotional-text 170 \
  --limit-description 4000 \
  --limit-keywords 100
```

### Google Play Console

List existing listings/languages:

```bash
npm run dev -- gpc-list-listings --package-name <PACKAGE_NAME>
```

Sync fields from source locale to specific locales:

```bash
npm run dev -- gpc-sync \
  --package-name <PACKAGE_NAME> \
  --source-locale en-US \
  --target-locales tr-TR,fr-FR
```

Sync only title:

```bash
npm run dev -- gpc-sync \
  --package-name <PACKAGE_NAME> \
  --fields title \
  --target-locales tr-TR
```

Dry run + preview:

```bash
npm run dev -- gpc-sync \
  --package-name <PACKAGE_NAME> \
  --fields title,shortDescription \
  --target-locales tr-TR \
  --dry-run \
  --preview
```

Use local files as source text instead of Play source locale:

```bash
npm run dev -- gpc-sync \
  --package-name <PACKAGE_NAME> \
  --source-title-file ./sources/title.txt \
  --source-short-description-file ./sources/short.txt \
  --source-full-description-file ./sources/full.txt \
  --target-locales tr-TR
```

Disable creating missing locales:

```bash
npm run dev -- gpc-sync \
  --package-name <PACKAGE_NAME> \
  --no-create-missing \
  --target-locales tr-TR,fr-FR
```

## Notes

- `sync` and `gpc-sync` both support `--strict-limits` to fail instead of skipping over-limit fields.
- `gpc-sync` defaults to syncing `title`, `shortDescription`, and `fullDescription`. If source fields are empty in Play, use `--fields` or source files to avoid empty updates.

## Store Consistency Rules

### Character limits

- App Store:
  - `name`: 30
  - `subtitle`: 30
  - `promotionalText`: 170
  - `keywords`: 100 bytes
  - `description`: 4000
  - `whatsNew`: 4000
- Google Play:
  - `title`: 30
  - `shortDescription`: 80
  - `fullDescription`: 4000

### Screenshot requirement check

- App Store: screenshots are required for submission/review per required device sizes.
  Source: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/
- Google Play: for publishing, Google Play requires at least 2 screenshots (across supported device types).
  Source: https://support.google.com/googleplay/android-developer/answer/9859152

### Publish vs draft note

- These media requirements are strict for publish/review flows. Draft-save behavior can be less strict depending on where you are in each console flow.

### Locale workload note

- Google Play generally has broader locale coverage options than App Store localizations, so locale management load is typically higher on Play.
  - Play language support reference: https://support.google.com/googleplay/android-developer/answer/9844778
  - App Store localizations reference: https://developer.apple.com/help/app-store-connect/manage-app-information/reference/app-store-localizations/

### iOS app name persistence

- If downloaded app name must match store name, keep `CFBundleDisplayName` (and usually `CFBundleName`) aligned with localized store name.
- Web panel can generate locale-based `InfoPlist.strings` content from your naming overrides.
