# Stream Deck Install & Profile Troubleshooting

Recurring issues we hit getting the Facet plugin onto a fresh PC — what failed, why, and the
exact fixes. Use this when setting up or testing on another machine.

---

## TL;DR — correct workflow for a fresh PC

Do **not** rely on `streamdeck link` to test profiles. The import prompt only fires on a real
install.

```powershell
# 1. Build the plugin
cd plugin
npm install
npm run build            # → com.swrobotics.facet.sdPlugin/bin/plugin.cjs

# 2. Build a real installable package
streamdeck pack --output .\dist "com.swrobotics.facet.sdPlugin"
#    (add --ignore-validation if only image-format warnings appear)

# 3. Start the mock add-in (SolidWorks stand-in)
cd ../tools
npm install
node mock-addin.mjs --auto        # listens on ws://localhost:8723

# 4. Install the package — THIS triggers the profile install prompt
#    Double-click the .streamDeckPlugin (or: Start-Process com.swrobotics.facet.streamDeckPlugin)
#    Accept the Facet / FacetXL profile when the app asks.
```

Verify: a new folder appears in `%APPDATA%\Elgato\StreamDeck\ProfilesV3` and the app log shows

```
UIProfiles inf ESDProfileOperationImportFromPlugin::importProfile Profile FacetXL installed for @(1)[...]
```

The three issues below are the things that silently break this flow.

---

## Issue 1 — Plugin crashes instantly / "Plugin is unstable and was disabled"

**Symptom.** The plugin process exits immediately. The app log
(`%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log`) repeats every ~10 s:

```
SDK inf ESDNativeRuntime::logProcessTermination  [com.swrobotics.facet] Process stopped (unexpected): code=0x00000001
SDK war ESDCustomPluginClient::enterRestarting   [com.swrobotics.facet] Schedule to be restarted in 10 seconds
...
SDK war ESDCustomPluginClient::enterDisabled     [com.swrobotics.facet] Plugin is unstable an was disabled.
```

**Root cause.** `rollup.config.mjs` emits **CommonJS** (`format: "cjs"`) to
`bin/plugin.js`, but `plugin/package.json` declares `"type": "module"`. Node therefore treats
`bin/plugin.js` as an ES module and dies on the first `require(...)`:

```
ReferenceError: require is not defined in ES module scope
This file is being treated as an ES module because ... package.json contains "type": "module".
```

Run the entry point directly to reproduce:

```powershell
node com.swrobotics.facet.sdPlugin/bin/plugin.js   # ← fails with the ReferenceError
```

**Fix.** Name the bundled output `.cjs` so it is always CommonJS regardless of `"type": "module"`:

- `rollup.config.mjs` → `output.file: "com.swrobotics.facet.sdPlugin/bin/plugin.cjs"`
- `manifest.json` → `"CodePath": "bin/plugin.cjs"`

Then `npm run build` and delete any stale `bin/plugin.js`. Confirm:

```powershell
node com.swrobotics.facet.sdPlugin/bin/plugin.cjs   # starts and idles (no error)
```

> Note: `streamdeck validate` does **not** catch this — it only checks the manifest schema.

---

## Issue 2 — Bundled profile never imports when using `streamdeck link`

**Symptom.** The plugin installs and loads (the Facet Key action appears), but no profile is
offered and nothing new shows in the profile switcher or `ProfilesV3`.

**Root cause.** `streamdeck link` creates a *junction* into your source folder and registers the
plugin in **developer mode**. Developer/linked plugins are never run through the app's profile
importer (`ESDProfileOperationImportFromPlugin`), so bundled profiles are silently skipped. In the
app log you will see the plugin connect but **no** `ImportFromPlugin` line for it.

**Fix.** Test with a real package install instead:

```powershell
streamdeck pack --output .\dist "com.swrobotics.facet.sdPlugin"
# then open / double-click the resulting .streamDeckPlugin file
```

This runs the full install flow (`ESDPluginManager::InstallPlugin` → profile import). To return to
dev iteration later, remove the installed copy from `%APPDATA%\Elgato\StreamDeck\Plugins` and
re-`streamdeck link`.

---

## Issue 3 — Profile import runs but fails: "Failed to import profile FacetXL"

**Symptom.** With a real package install, the log shows the import was *attempted* but rejected
with no further detail:

```
UIProfiles err ESDProfileOperationImportFromPlugin::importProfile Failed to import profile FacetXL
```

**Root cause.** The app's plugin-profile importer (`ESDProfileOperationImportFromPlugin`) only
accepts the **legacy flat "Version 1.0" bundle** — the format the bundled Elgato **tutorial**
plugin ships. The **V3 page-folder format** (`Device` + `Pages` + `Profiles/<page-uuid>/...`,
Version "2.0"/"3.0") that we originally generated is only used by the app's own first-run default
profiles (`C:\Program Files\Elgato\StreamDeck\DefaultProfiles\*.streamDeckProfile`), which go
through a different import path. A V3-shaped plugin bundle is rejected with that opaque error.

**Fix.** Generate the legacy flat format. Ground truth to copy on any PC:
`%APPDATA%\Elgato\StreamDeck\Plugins\com.elgato.tutorial.sdPlugin\profiles\Tutorial XL.streamDeckProfile`.

The zip layout is `<random-uuid>.sdProfile/manifest.json` at the archive root, named
`<Name>.streamDeckProfile` (must match the `Name` in the manifest's `Profiles[]` entry).

```json
{
  "Actions": {
    "0,0": {
      "Name": "Facet Key",
      "Settings": {},
      "State": 0,
      "States": [
        {
          "FFamily": "",
          "FSize": "13",
          "FStyle": "",
          "FUnderline": "off",
          "Image": "",
          "Title": "",
          "TitleAlignment": "bottom",
          "TitleColor": "#F2F5F8",
          "TitleShow": "on"
        }
      ],
      "UUID": "com.swrobotics.facet.key"
    }
  },
  "DeviceModel": "20GAT9901",
  "InstalledByPluginUUID": "com.swrobotics.facet",
  "Name": "FacetXL",
  "PreconfiguredName": "FacetXL",
  "Version": "1.0"
}
```

Key requirements:

- **`DeviceModel` must match the connected device's model id exactly**, or the importer aborts
  with `import aborted [...] no matching or required profiles found`. To find the id on a fresh
  PC, open any profile the app already created for the device:
  `%APPDATA%\Elgato\StreamDeck\ProfilesV3\*.sdProfile\manifest.json` → `Device.Model`.
  Known values: Stream Deck XL = `20GAT9901`, MK.2 = `20GAA9901`. (The app's own
  `DefaultProfiles` use `20GAT9902`/`20GAA9902` — different import path, don't copy those.)
- **Action entries** are flat per key: `Name`, `Settings`, `State`, `States` (with the legacy
  `F*` field names), `UUID`. No `ActionID`/`Plugin`/`Resources` fields.
- `InstalledByPluginUUID` = `com.swrobotics.facet`; `PreconfiguredName` = the same value as the
  manifest's `Profiles[].Name`.

The generator lives in `plugin/scripts/gen-profile.ps1` (run `npm run profile` from `plugin/`) and
emits both `Facet` (MK.2, 15 keys) and `FacetXL` (XL, 32 keys). On import the app converts this
legacy bundle into ProfilesV3, remaps `Device.Model` to the real device, and auto-switches the deck
to it (manifest `DontAutoSwitchWhenInstalled: false`).

---

## Verification & log reading

App log (the fastest source of truth):
`%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log`

| What you're looking for | Log line |
| --- | --- |
| Plugin loaded OK | `ESDCustomPlugin::onSessionConnected [com.swrobotics.facet] Plugin connected` |
| Profile imported | `ESDProfileOperationImportFromPlugin::importProfile Profile FacetXL installed for @(1)[...]` |
| Import rejected | `... importProfile Failed to import profile FacetXL` (Issue 3) |
| No matching device model | `import aborted [...] no matching or required profiles found` (Issue 3) |
| Plugin crash loop | `Process stopped (unexpected): code=0x00000001` → `... is unstable an was disabled` (Issue 1) |

On-disk check after a successful import:
`%APPDATA%\Elgato\StreamDeck\ProfilesV3\<new-uuid>.sdProfile\` contains a `manifest.json`
(`Version "3.0"`, `InstalledByPluginUUID: com.swrobotics.facet`) and a `Profiles/<page-uuid>/`
page manifest whose Keypad controller lists all 32 actions at `0,0` … `7,3`.

---

## Reference — useful commands

```powershell
streamdeck list                                # what's registered (note: real installs vs junctions)
streamdeck link com.swrobotics.facet.sdPlugin  # dev iteration (Issue 2: skips profile import)
streamdeck unlink com.swrobotics.facet
streamdeck pack --output .\dist "com.swrobotics.facet.sdPlugin"   # real installable package
streamdeck validate com.swrobotics.facet.sdPlugin                 # manifest checks only
streamdeck restart com.swrobotics.facet
```

Useful paths on Windows:

- Installed plugins: `%APPDATA%\Elgato\StreamDeck\Plugins\*.sdPlugin`
- Imported profiles (V3): `%APPDATA%\Elgato\StreamDeck\ProfilesV3\*.sdProfile`
- App log: `%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log`
- App's own bundled default profiles (V3 format — **not** what plugin bundles should use):
  `C:\Program Files\Elgato\StreamDeck\DefaultProfiles\*.streamDeckProfile`
- Bundled tutorial plugin (legacy format — the correct template):
  `%APPDATA%\Elgato\StreamDeck\Plugins\com.elgato.tutorial.sdPlugin\profiles\*.streamDeckProfile`