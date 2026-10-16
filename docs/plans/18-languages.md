# Phase 18: languages

The design. What's still to do, and its status, is on GitHub: [Phase 18: languages](https://github.com/TommiContursi/Polku/milestone/8), phase issue #184. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)).

## Phase 18 — Languages (planned 2026-10-14)

A language switcher in Settings, with flags: English, Finnish, Swedish. By default, the browser's or phone's language (`navigator.languages`); English otherwise.
- **All text in one place per language** (`js/i18n/en.js`, `fi.js`, `sv.js`), looked up by key. English is the fallback for anything not yet translated.
- **Formats follow the language** (`Intl`): numbers, dates and times, km and m.
- **What doesn't translate:** the map's own labels (OpenFreeMap has `name:fi` / `name:sv` for place names, a style choice) and sources' wording (LIPAS's Finnish names stay).
- **Flags with the language's name beside them,** since a flag is a country, not a language (Swedish in Finland). Remembered on the device; `?lang=` in links.
- **Before the help and tutorial** (phase 19), so those are written once per language.
