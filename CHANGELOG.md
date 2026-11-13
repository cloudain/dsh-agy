# Changelog

All notable changes to `dsh-agy` are documented in this file.

## [0.4.8] - 2026-11-13

### Fixed

- **Unified thinking family account matching (`src/session.ts`)**: `isModelSupportedByAccount()` now recognizes merged family model IDs (such as `gemini-4-argon`, `gemini-4-hydrogen`, `claude-opus-5-5`, and `claude-sonnet-5-5`) as supported when the account's `cachedModels` contains any discrete effort/tiered variant (`-low`, `-medium`, `-high`, `-xhigh`, `-max`, or `-tiered`), preventing spurious `"No agy account configured — run dsh-agy login first."` errors during pool selection and test calls.
- **`gemini-4-hydrogen` thinking configuration (`src/adapter/translate.ts`)**: Added `gemini-4-hydrogen` to the discrete-variant family guard alongside `gemini-4-argon`, `claude-opus-5-5`, and `claude-sonnet-5-5` so requests without a custom thinking budget do not attach an incompatible `thinkingLevel` field.
- **Context window resolution for dynamically discovered models (`src/adapter/models.ts`)**: Preserved upstream `maxTokens` from `v1internal:fetchAvailableModels` in `DISCOVERED_CONTEXT_WINDOWS` and added family defaults (`1048576` for `gemini-*`, `200000` for `claude-*`) in `mergeModelCatalog()` and `resolveAgyModel()`, preventing `compaction-basic: no context capacity` errors when switching to uncataloged models such as `gemini-4-hydrogen-xhigh`.

### Tests

- Added regression tests in `tests/session.test.ts` for split-family account matching (`gemini-4-argon`, `gemini-4-hydrogen`, `gemini-4-hydrogen-xhigh`, `claude-opus-5-5`, `claude-sonnet-5-5`) and in `tests/adapter.test.ts` for `resolveAgyModel('agy', 'gemini-4-hydrogen-xhigh')` `contextWindow`.

## [0.4.7] - 2026-11-08

- Antigravity 2.x support, switchable client UA profiles, Gemini quota display fix, and prebuilt `lib/` artifacts.
