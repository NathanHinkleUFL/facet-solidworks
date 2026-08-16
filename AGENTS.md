# Facet XL — AI Agent Project Instructions

Read `planning.md` in this directory before doing anything else. It contains the full
project context, architecture, development phases, and collaboration rules. Do not skip it.

---

## Project in one paragraph

This is a fork of `netarcx/facet-solidworks` — a context-aware Stream Deck companion for
SolidWorks — adapted for the Stream Deck XL (8×4, 32 keys). The original targets the MK.2
(5×3, 15 keys). We are developing independently in this fork and are not merging back
upstream at this time. We are also adding a Bambu P1S printer integration as a Phase 5
feature — live print status, controls, and a SolidWorks-to-printer workflow button.

---

## Collaboration rules

- **Nathan** owns this fork and does all development
- **Rich (Dad)** reviews and merges pull requests — he does not commit directly
- All work goes in **feature branches** — never commit directly to `main`
- Open a **pull request** when a feature or phase is ready for review; tag Rich
- **Never open a PR against `netarcx/facet-solidworks`** — our fork is our own project
- Keep commits small and focused — one logical change per commit makes reviews easier

---

## Where we are

Check `planning.md` → "Our Development Phases" for the current task list and which items
are checked off. Start with the first unchecked 🌐 item in the earliest incomplete phase.

If Nathan tells you what was done in the last session, pick up from there. If unsure,
ask before assuming.

---

## Key development facts

- **Plugin side (TypeScript/Node.js)** — buildable and testable on any laptop
- **Add-in side (C#)** — requires the SolidWorks laptop (needs SolidWorks interop DLLs)
- **Testing without SolidWorks** — always use `node ../tools/mock-addin.mjs` first;
  it simulates context switching so you can validate the full deck experience locally
- **Device string for XL** — verify the correct Elgato SDK identifier before hardcoding;
  it is likely `streamdeck_mk2_xl` but confirm against current SDK docs
- **catalog.json is the source of truth** — all layouts, all key bindings live here;
  the plugin reads it at runtime, never hardcode layout data in TypeScript

---

## Repository layout

```
addin/        C# SolidWorks add-in (compile on SolidWorks laptop only)
plugin/       Node.js/TypeScript Stream Deck plugin (work on any laptop)
shared/       catalog.json, design-tokens.json, protocol.md
tools/        mock-addin.mjs — fake SolidWorks server for local testing
installer/    Inno Setup scripts (SolidWorks laptop only)
planning.md   Full project plan — read this first every session
AGENTS.md     This file — auto-loaded by OpenCode and other AI agents
```

---

## Before creating a PR

1. Run `npm run build` in `plugin/` — confirm it compiles with no errors
2. Test with the mock add-in — confirm context switching and key rendering work on the XL
3. Make sure the branch is up to date with `main` (`git pull origin main`)
4. Write a clear PR description explaining what changed and why
5. Note in the PR description whether the SolidWorks laptop is needed to fully test it
