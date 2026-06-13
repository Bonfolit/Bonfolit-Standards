---
description: Bootstrap a new Bonfolit Unity game from the standards — drive 00-new-project-bootstrap.md Phase 0 → 6 with checkpoints.
argument-hint: "[game name] [framework source: pathA-package | pathB-scaffold]"
allowed-tools: [Read, Grep, Glob, Write, Edit, Bash]
---

# /bonfolit-standards:bootstrap

Stand up a new Bonfolit game from the standards. Args (optional): $ARGUMENTS

## Steps

1. **Read the guide.** Open the bootstrap doc bundled with this plugin —
   `docs/00-new-project-bootstrap.md` (relative to this plugin root, beside the
   `commands/` folder) — and follow it **top to bottom**. Each phase ends in a
   verifiable checkpoint; do not advance past a red checkpoint.

2. **Phase 0 decisions (ask the human once):** game name + company prefix +
   namespaces, framework source (Path A imported package vs Path B scaffolded
   in-repo), backend now vs offline-for-now, target platforms/min OS, orientation.
   Record every answer in the game's `CLAUDE.md`.

3. **Stamp the project memory.** Copy this plugin's `templates/CLAUDE.template.md`
   to the new project root as `CLAUDE.md`, then fill the "Project specifics" block
   with the Phase 0 answers. Note in it that the Bonfolit Standards are provided by
   the installed **bonfolit-standards** plugin (docs are sole-source there — do not
   copy `docs/` into the game).

4. **Work the phases:** packages & settings (doc 12) → folder/assembly skeleton
   (doc 02) → contexts/scenes/installers (doc 03/04) → core systems bring-up if
   Path B (doc 00 Phase 5; use the **core-system-bringup** skill) → first feature
   (use the **add-feature** skill) → full verification list.

5. **Finish on green:** run **/bonfolit-standards:release-check** and confirm every
   Phase 6 checkbox (release compiles, EditMode green, boots from `Root.unity`,
   device build installs, `CLAUDE.md` placeholders resolved).

Throughout, obey the 12 hard rules (see the **bonfolit-standards** skill); when a doc
and a local file disagree, the doc wins — flag it.
