# Device Status plugin setup guide

This file documents the steps used to turn this folder into a loadable local Obsidian plugin.

## Goal

Create a local development plugin inside the test vault so Obsidian can detect it, load it, and let future changes be tested quickly.

## Starting point

The plugin was created from the Obsidian sample plugin template and placed in:

`.obsidian/plugins/obsidian-device-status/`

That folder location is correct for local plugin development inside a vault.

## Steps taken

### 1. Place the plugin in the vault plugin folder

Obsidian looks for local community plugins inside:

`.obsidian/plugins/<plugin-id>/`

For this project, the folder name is:

`obsidian-device-status`

### 2. Make the plugin ID match the folder name

The sample template started with a different plugin ID.

The following file was updated:

- `manifest.json`

The important value is:

- `"id": "obsidian-device-status"`

This matters because Obsidian expects the plugin folder name and manifest ID to refer to the same plugin.

### 3. Rename the package metadata

The following file was updated:

- `package.json`

The package name was aligned with the plugin identity:

- `"name": "obsidian-device-status"`

This does not control whether Obsidian loads the plugin, but it keeps the development project consistent.

### 4. Install development dependencies

From the plugin folder, run:

```bash
npm install
```

This installs TypeScript, esbuild, Obsidian typings, and the rest of the local development toolchain.

### 5. Build the plugin bundle

From the plugin folder, run:

```bash
npm run build
```

This compiles the TypeScript source from `src/` into:

- `main.js`

Obsidian loads `main.js`, not `src/main.ts`.

### 6. Keep the required runtime files at the plugin root

For a local plugin to load in Obsidian, these files need to exist at the top level of the plugin folder:

- `manifest.json`
- `main.js`
- `styles.css` (optional, but present here)

### 7. Enable the plugin in the test vault

Obsidian stores enabled community plugins in:

- `.obsidian/community-plugins.json`

This plugin was added there so the test vault can load it:

- `"obsidian-device-status"`

## Current result

The plugin is now:

- stored in the correct local plugin folder
- named consistently across folder and manifest
- built into a real `main.js`
- enabled in the test vault

## Notes for future development

- Edit source files in `src/`
- Rebuild with `npm run build` after changes
- For automatic rebuilding during development, run `npm run dev`
- Reload Obsidian after rebuilding to pick up changes

## Git note

This guide file is intended to stay in the repository and can be committed to the main branch.

`main.js` is still ignored by `.gitignore`, which is normal for an Obsidian plugin source repository. The source files and documentation should be committed; the built artifact is usually produced locally or attached to releases.
