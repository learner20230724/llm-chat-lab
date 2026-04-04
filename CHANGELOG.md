# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] — 2026-04-04

### Added
- **Custom user preset save/load** — users can now save their own presets with a custom name and system prompt via the "Save as preset" toolbar button. Custom presets appear in the preset selector, persist across sessions (localStorage), and are included in export/import of layouts.
- **Custom preset deletion** — delete unwanted custom presets directly from the preset selector context.
- **Ctrl+Enter shortcut** — modal save button responds to Ctrl+Enter for faster preset creation.
- **Esc to close** — preset modal closes on Esc key.
- **Comparison bar with metrics diff** — side-by-side latency / token / cost comparison with diff highlighting.
- **Multi-provider support** — OpenAI (`gpt-4o-mini`, `gpt-4o`) and Anthropic (`claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022`) in a single UI.
- **Export/Import layouts** — full panel configuration (models, presets, system prompts, temperatures, input text) serialised and restorable.
- **Screenshot-friendly share states** — auto-hiding toasts and clean card layouts for screen capture.
- **Mock mode** — fully functional without API keys for demo and development.

### Changed
- `public/app.js` refactored with `getCustomPresets()` / `saveCustomPreset()` / `deleteCustomPreset()` / `mergePresets()` / `buildPresetOptions()`.
- `applySnapshot()` now restores custom presets by matching system prompt text on import.
- `buildMockResponse()` uses `mergePresets()` so custom presets are available in mock mode.

---

## [0.1.0] — 2026-04-03

### Added
- Initial release — side-by-side LLM comparison UI with OpenAI and Anthropic provider support.
- Model preset selector, system prompt editor, temperature control.
- Comparison preview screenshot asset.
- `.env.example` with API key documentation.
