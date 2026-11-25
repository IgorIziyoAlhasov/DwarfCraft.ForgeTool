# DwarfCraft ForgeTool

A local, read-only inspector for DwarfCraft StarCraft II Arcade bank files. The browser reads selected files directly and computes SHA-256 on their original bytes. Gameplay banks are kept outside Git.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Choose a primary bank to browse its XML fields. Choose a comparison bank to see added, removed, and changed entries side by side.

DwarfCraft labels apply to observed version-1 fields. Other fields remain visible under their XML names. The structural comparison matches sections and keys by name and occurrence and ignores reordering of uniquely named entries. Use the hash to detect any byte difference, including formatting. The source view shows decoded UTF-8 text.

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run qa:regressions
```
