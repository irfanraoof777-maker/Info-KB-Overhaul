---
name: Artifact registration gap
description: The infokb artifact.toml exists but the platform registry is empty; screenshot tool and presentArtifact fail
---

`listArtifacts()` returns `[]` even though `artifacts/infokb/.replit-artifact/artifact.toml` is present.
The managed workflow `artifacts/infokb: web` does not exist in the config.
The app runs correctly via the manually configured "Start application" workflow on port 3000.

**Why:** The platform artifact registry was likely cleared when the project was imported from GitHub. The artifact.toml has `localPort = 24431` but the current workflow uses port 3000.

**How to apply:** Screenshot via `appPreview` will fail with "Artifact not found: infokb". Use RefreshAllLogs to verify app health instead. A follow-up task (#4) exists to fix the registration properly.
