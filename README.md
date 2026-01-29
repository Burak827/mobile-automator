# Mobile Automator (App Store Connect)

CLI to sync App Store localization fields (description, promotional text, what's new)
from a source locale (default: en-US) across other locales using AI, then update App Store Connect.

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
- ASC_SYNC_FIELDS (comma-separated: description,promotionalText,whatsNew)
- ASC_LIMIT_DESCRIPTION (number, default: 4000; set 0 to disable)
- ASC_LIMIT_PROMOTIONAL_TEXT (number, default: 170; set 0 to disable)
- ASC_LIMIT_WHATS_NEW (number, default: 4000; set 0 to disable)
- ASC_STRICT_LIMITS (true/false)
- ASC_BASE_URL (default: https://api.appstoreconnect.apple.com)
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

Sync fields from English to specific locales:

```
npm run dev -- sync-description \
  --version-id <VERSION_ID> \
  --source-locale en-US \
  --target-locales tr-TR,fr-FR
```

Sync fields for all existing locales (except source):

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

Use latest version automatically (highest createdDate/versionString):

```
npm run dev -- sync-description --app-id <APP_ID> --target-locales tr-TR
```

Sync only specific fields:

```
npm run dev -- sync-description \
  --version-id <VERSION_ID> \
  --fields description,promotionalText
```

Preview translated text:

```
npm run dev -- sync-description --version-id <VERSION_ID> --preview
```

Override length limits (set 0 to disable):

```
npm run dev -- sync-description \
  --version-id <VERSION_ID> \
  --limit-promotional-text 170 \
  --limit-description 4000
```
