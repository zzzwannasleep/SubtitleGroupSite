---
title: Observability Cut
slug: 2026-05-13-observability-cut
summary: Added search request telemetry, comment failure diagnostics, and an admin operations board that closes the first-pass observability slice.
publishedAt: "2026-05-13"
---

## What shipped

- Added persistent `search_requests` telemetry for non-empty search queries
- Added persistent `comment_failures` telemetry for rejected comment submissions
- Introduced an admin operations board for download clicks, search flow, and comment failure clusters
- Updated the home surface and footer copy to reflect the current product state instead of the early skeleton phase

## Why it matters

The project already had content, auth, comments, and downloads in place. This cut closes the missing operations loop so the team can see whether search is being used, where comment submissions fail, and which delivery links take the most traffic.
