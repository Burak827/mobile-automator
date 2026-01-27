# Mobile Automator (App Store Connect)

CLI to sync App Store description translations from a source locale (default: en-US)
across other locales using AI, then update App Store Connect.

## Setup

1. Install dependencies:

```
npm install
```

2. Copy the env template and fill in values:

```
cp .env.example .env
```

Required env vars:
- ASC_ISSUER_ID
- ASC_KEY_ID
- ASC_PRIVATE_KEY_PATH
- OPENAI_API_KEY
- OPENAI_MODEL

Optional env vars:
- ASC_APP_ID
- ASC_VERSION_ID
- ASC_PLATFORM (default: IOS)
- ASC_SOURCE_LOCALE (default: en-US)
- ASC_TARGET_LOCALES (comma-separated)
- OPENAI_BASE_URL (default: https://api.openai.com/v1)

## Commands

List versions for an app:

```
npm run dev -- list-versions --app-id <APP_ID>
```

List localizations for a version:

```
npm run dev -- list-localizations --version-id <VERSION_ID>
```

Sync description from English to specific locales:

```
npm run dev -- sync-description \
  --version-id <VERSION_ID> \
  --source-locale en-US \
  --target-locales tr-TR,fr-FR
```

Sync description for all existing locales (except source):

```
npm run dev -- sync-description --version-id <VERSION_ID>
```

Resolve version by version string:

```
npm run dev -- sync-description \
  --app-id <APP_ID> \
  --version-string 1.2.3 \
  --target-locales tr-TR
```

Dry run (no updates):

```
npm run dev -- sync-description --version-id <VERSION_ID> --dry-run
```
