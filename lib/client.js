window.__ModuleLoader__.load({
	id: "dsh-agy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client/styles.ts
		/**
		* Injected stylesheet for the agy Settings section.
		*
		* Plain CSS in a single <style> element rather than CSS modules: this plugin
		* ships one bundle and cannot rely on the host's bundler to process a
		* `*.module.css` import.
		*
		* Follows DSH's own styling contract (deepseek-harness `docs/web-styling.md`):
		*
		* - Colours come from `--dsw-alias-*` semantic tokens, never literal values, so
		*   the section follows the host's light/dark theme instead of shipping a
		*   second palette that drifts.
		* - Text uses the theme's typography ROLE variables (`--dsw-font-*`, which carry
		*   family + size + line-height + weight together) rather than hand-picked
		*   `font-size`/`font-weight` pairs. A hand-picked 550 is not in the host's
		*   scale and is what made this page read heavier than a native section.
		* - Neutral solid borders draw at `0.5px`, the shared hairline weight.
		* - Controls are NOT styled here: they come from the
		*   `@deepseek-ai/dsh-client-ui-primitives` catalog (Button/Switch/Input/Tag/
		*   StateDot), so focus rings, disabled states and size tiers are the
		*   platform's own. This file covers layout and the data visualisations the
		*   host has no primitive for.
		*/
		const STYLE_ID = "dsh-agy-styles";
		/**
		* Single source of truth for `--dsw-alias-*` fallbacks: the colour an alias
		* renders with when the host theme has not defined it. The host owns the real
		* values; this table only pins the degraded-mode answer, and every usage must
		* go through `aliasVar()` so one alias cannot carry two answers — without the
		* table the file grew three values for `border-l2` and a renamed-forever
		* `--dsw-alias-brand-primary-new-colorprimary-new-color` that no host defines.
		* Normalisation picks (degraded-mode only, enforced by the alias scans in
		* tests/client.test.ts): `state-success` took `#10b981` over the duplicated
		* `#22c55e` because the 60%-alpha glow variant derives from the same base, and
		* `state-business` took the brand blue over the popover pill's emerald —
		* active/cooling/disabled reads as blue/amber/grey, not success-green.
		*/
		const ALIAS_FALLBACKS = {
			"bg-layer-1": "#fff",
			"bg-layer-2": "#f4f5f7",
			"bg-layer-3": "#fff",
			"bg-overlay": "#fff",
			"border-l1": "rgba(0,0,0,.04)",
			"border-l2": "#e5e6eb",
			"border-l3": "rgba(0,0,0,.15)",
			"brand-primary": "#4176e6",
			"interactive-bg-hover": "#f4f5f7",
			"label-primary": "#1f2329",
			"label-secondary": "#61666b",
			"label-tertiary": "#8f959e",
			"state-business-primary": "#4176e6",
			"state-error-primary": "#ec1313",
			"state-error-secondary": "#f59e0b",
			"state-success-primary": "#10b981",
			"state-warn-primary": "#f59e0b"
		};
		function aliasVar(alias) {
			return `var(--dsw-alias-${alias}, ${ALIAS_FALLBACKS[alias]})`;
		}
		const AGY_STYLES_CSS = `
.agy-root { display: flex; flex-direction: column; gap: 12px; font: var(--dsw-font-xs-13); }
.agy-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.agy-title { font: var(--dsw-font-base-strong-16); color: ${aliasVar("label-primary")}; }
.agy-sub { margin-top: 3px; font: var(--dsw-font-xxs-12); color: ${aliasVar("label-tertiary")}; }

.agy-tabs {
  display: flex; align-items: flex-end; gap: 22px; margin-top: 2px;
  border-bottom: 0.5px solid ${aliasVar("border-l2")};
}
.agy-tab {
  position: relative; border: 0; padding: 7px 1px 9px; background: transparent;
  color: ${aliasVar("label-tertiary")};
  font: var(--dsw-font-xs-13); cursor: pointer;
}
.agy-tab:hover, .agy-tab[data-active="true"] { color: ${aliasVar("label-primary")}; }
/* Active tab is an underline rule, matching the Plugins settings section's own
   tab bar rather than introducing a second, boxed tab idiom. */
.agy-tab[data-active="true"]::after {
  position: absolute; right: 0; bottom: -1px; left: 0; height: 2px;
  border-radius: 2px 2px 0 0; background: ${aliasVar("label-primary")};
  content: '';
}
.agy-tab:focus-visible {
  outline: 2px solid ${aliasVar("state-business-primary")};
  outline-offset: 2px;
  border-radius: 4px;
}
.agy-tab .agy-count { margin-left: 5px; font: var(--dsw-font-xxxs-11); color: ${aliasVar("label-tertiary")}; }

/* A failed action states WHAT failed and then WHY, on two lines. The default
   white-space (normal) folds that newline into a space and runs the verdict
   into the upstream error, so the separator has to be preserved here exactly as
   .agy-notice already does for its own multi-line form. */
.agy-error { padding: 9px 12px; border-radius: 8px; font: var(--dsw-font-xxs-12);
  white-space: pre-wrap; overflow-wrap: anywhere;
  color: ${aliasVar("state-error-primary")};
  background: color-mix(in srgb, ${aliasVar("state-error-primary")} 10%, transparent); }
/* A non-fatal outcome (a partial import). Neutral, not alarming, and it keeps
   newlines so a list of per-source failures stays readable. */
.agy-notice { padding: 9px 12px; border-radius: 8px; font: var(--dsw-font-xxs-12);
  white-space: pre-wrap; overflow-wrap: anywhere;
  color: ${aliasVar("label-secondary")};
  background: ${aliasVar("bg-layer-2")}; }
.agy-empty { padding: 24px 12px; text-align: center; font: var(--dsw-font-xs-13); color: ${aliasVar("label-tertiary")}; }
.agy-hint { margin: 0; font: var(--dsw-font-xxs-12); color: ${aliasVar("label-tertiary")}; }
.agy-aside { font: var(--dsw-font-xxxs-11); color: ${aliasVar("label-tertiary")}; }
.agy-grow { flex: 1; }

/* ── Grouping surface ───────────────────────────────────────────────────────
   DSH groups with spacing first and a light container second. A settings page
   built only from tables reads as a spreadsheet, so each block gets a card. */
.agy-card {
  border: 0.5px solid ${aliasVar("border-l2")};
  border-radius: 12px;
  background: ${aliasVar("bg-layer-3")};
  overflow: hidden;
}
.agy-card-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 12px;
  border-bottom: 0.5px solid ${aliasVar("border-l1")};
  background: ${aliasVar("bg-layer-2")};
}
.agy-card-title { font: var(--dsw-font-xs-strong-13); color: ${aliasVar("label-primary")}; }
.agy-card-body { padding: 6px 12px 8px; }

/* ── Rows inside a card ────────────────────────────────────────────────────
   Follows DSH's own list-row convention (ui-sidebar .panelRow): a 12px-radius
   rounded rect inset 2px from the card edge and transparent at rest. A
   full-bleed rectangle reads as a slab and fights the card's own radius. */
.agy-rows { display: flex; flex-direction: column; gap: 2px; }
/* The live line: one status strip above the rows, present ONLY while upstream
   requests are in flight — an idle pool renders no strip, so quiet stays quiet.
   The pulsing dot is the host StateDot primitive ('ongoing'), so the animation
   is the platform's; this rule is layout and tone only. Sits OUTSIDE .agy-rows,
   so the master list's scroll cap does not scroll the status away. */
.agy-live {
  display: flex; align-items: center; gap: 7px;
  margin: 2px 2px 6px; padding: 7px 8px; border-radius: 10px;
  font: var(--dsw-font-xxs-12); color: ${aliasVar("label-secondary")};
  background: ${aliasVar("bg-layer-2")};
}
/* Master/detail: the account list beside the selected account's detail, so a
 * row and the panel it opens stay in view together — but only when the
 * container can host both columns comfortably. The Settings panel gives the
 * wrap ~564px of inline space on desktop (800px modal - 188px nav - 48px
 * padding), so at the panel the split STACKS into one full-width column:
 * 564px cannot host two comfortable columns, and a forced 300px master
 * truncated every email to "a1…" while squeezing the detail to ~280px (the
 * original "panel feels too narrow" report). The breakpoint therefore sits
 * ABOVE the panel width and must stay there; if the host's modal geometry
 * changes, re-measure before moving it. The query is a CONTAINER one because
 * the former viewport @media (max-width: 720px) never fired inside the panel.
 *
 * The containment lives on a dedicated wrapper, NOT on .agy-root:
 * container-type: inline-size applies layout containment, which makes the
 * element a containing block for fixed-position descendants — and the host's
 * Tooltip (used by the thinking-budget fields) positions its bubble with
 * position: fixed. Scoping it here keeps that behaviour intact.
 */
.agy-split-wrap { container-type: inline-size; }
.agy-split { display: grid; grid-template-columns: 1fr; gap: 12px; align-items: start; }
@container (min-width: 700px) {
  .agy-split { grid-template-columns: minmax(0, 300px) minmax(0, 1fr); }
}
/* Cap the master list so a large pool cannot push the detail it opens below the
   fold — the reason the split exists at all. Scoped to the split: the Models tab
   shares .agy-rows for its own long list and must keep growing freely. */
.agy-split .agy-rows { max-height: 300px; overflow-y: auto; }
.agy-rowitem {
  /* Flex-wrap, NOT the former grid-template-columns: minmax(0,1fr) auto.
     A grid's 1fr may shrink to zero, so the identity column yielded all its
     width to the action cluster: at the 300px master column the row's ~167px of
     state badge + Verify/Delete left ~45px for the email (which needs ~177px),
     truncating every address to "a1…" even though the row had room to grow
     downward. With a flex BASIS the actions wrap to a second line instead of
     squeezing the name, and margin-left: auto keeps them right-aligned on the
     same line whenever they do fit. */
  display: flex; flex-wrap: wrap;
  align-items: center; gap: 4px 12px;
  margin: 0 2px; padding: 10px 8px; box-sizing: border-box;
  min-height: 36px; border-radius: 12px; background: transparent;
}
.agy-rowitem[data-clickable="true"] { cursor: pointer; }
.agy-rowitem[data-clickable="true"]:hover {
  background: ${aliasVar("interactive-bg-hover")};
}
.agy-rowitem[data-selected="true"] {
  background: ${aliasVar("interactive-bg-hover")};
}
.agy-rowitem:focus-visible {
  outline: 2px solid ${aliasVar("label-primary")};
  outline-offset: -2px;
}
.agy-rowmain { min-width: 0; flex: 1 1 160px; display: flex; flex-direction: column; gap: 3px; }
.agy-rowtitle { display: flex; align-items: center; gap: 7px; min-width: 0; }
.agy-rowname {
  font: var(--dsw-font-xs-strong-13); color: ${aliasVar("label-primary")};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.agy-rowmeta {
  font: var(--dsw-font-xxxs-11); color: ${aliasVar("label-tertiary")};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* margin-left: auto right-aligns the cluster while it shares a line with the
   identity, and becomes inert once flex-wrap moves it to its own line. */
.agy-rowactions { display: flex; align-items: center; gap: 6px; flex: none; margin-left: auto; }
.agy-state { display: inline-flex; align-items: center; gap: 6px; flex: none; }

.agy-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.agy-actions > :first-child:not(button) { flex: 1; min-width: 150px; }
.agy-detail { display: flex; flex-direction: column; gap: 12px; }

/* ── Metric strip ────────────────────────────────────────────────────────── */
.agy-metrics { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); }
/* No vertical rules between cells: the columns read as separated already by
   the gap and their own left alignment, and the dividers turned a metric strip
   into a spreadsheet grid. */
.agy-metric { padding: 12px 0; }
.agy-metric-k { font: var(--dsw-font-xxxs-11); color: ${aliasVar("label-tertiary")}; }
/* The theme's own role carries family + size + line-height + weight; the
   metric only tightens the tracking. */
.agy-metric-v { margin-top: 4px; font: var(--dsw-font-base-strong-16); letter-spacing: -.015em;
  font-variant-numeric: tabular-nums; color: ${aliasVar("label-primary")}; }
.agy-metric-v small { margin-left: 2px; font: var(--dsw-font-xxs-strong-12);
  color: ${aliasVar("label-tertiary")}; }
.agy-metric-d { margin-top: 3px; font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")}; }

/* ── Token composition ─────────────────────────────────────────────────────
   A share bar per bucket, under the headline metrics. This exists to answer
   "why is cache read larger than the input?" with a proportion instead of
   prose: the cache re-reads the whole prefix each turn, so its share dominates.
   Rows are laid out as label / track / value / percent so the numbers stay in
   columns and remain scannable. */
.agy-compose { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.agy-compose-row {
  display: grid; grid-template-columns: 64px minmax(0,1fr) 56px 44px;
  align-items: center; gap: 10px;
}
.agy-compose-k { font: var(--dsw-font-xxxs-11); color: ${aliasVar("label-tertiary")}; }
.agy-compose-track {
  height: 6px; border-radius: 3px; overflow: hidden;
  background: ${aliasVar("border-l2")};
}
.agy-compose-track i { display: block; height: 100%; border-radius: 3px; }
.agy-compose-v { text-align: right; font: var(--dsw-font-xxs-12);
  font-variant-numeric: tabular-nums; color: ${aliasVar("label-secondary")}; }
.agy-compose-p { text-align: right; font: var(--dsw-font-xxxs-11);
  font-variant-numeric: tabular-nums; color: ${aliasVar("label-tertiary")}; }
/* A table's own footnote: states a column's scope that its header cannot. */
.agy-table-note { padding: 6px 8px 2px; }
/* The 65535 row is a CONFIGURATION of High, not a sibling tier: indenting it
   makes the dependency visible without adding a column or a badge. */
.agy-table td.agy-nested { padding-left: 20px; font-weight: 400; }

/* ── Definition rows (label / value pairs) ───────────────────────────────── */
.agy-defs { display: grid; grid-template-columns: 92px minmax(0,1fr); margin: 0; }
.agy-defs dt {
  padding: 7px 0; font: var(--dsw-font-xxs-12); color: ${aliasVar("label-tertiary")};
  border-bottom: 0.5px solid ${aliasVar("border-l1")};
}
.agy-defs dd {
  margin: 0; padding: 7px 0; font: var(--dsw-font-xxs-12); color: ${aliasVar("label-secondary")};
  border-bottom: 0.5px solid ${aliasVar("border-l1")};
  overflow-wrap: anywhere;
}
.agy-defs dt:last-of-type, .agy-defs dd:last-of-type { border-bottom: 0; }

/* ── Disclosure (the collapsible model-quota block) ──────────────────────── */
.agy-disclosure { border-top: 0.5px solid ${aliasVar("border-l1")}; }
.agy-disclosure-toggle {
  display: flex; align-items: center; gap: 7px; width: 100%;
  padding: 9px 0; border: 0; cursor: pointer;
  font: var(--dsw-font-xxs-strong-12); text-align: left;
  color: ${aliasVar("label-secondary")}; background: none;
}
.agy-disclosure-toggle:hover { color: ${aliasVar("label-primary")}; }
.agy-caret {
  flex: none; width: 0; height: 0; border-left: 4px solid currentColor;
  border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent;
  transition: transform .15s ease;
}
.agy-disclosure[data-open="true"] .agy-caret { transform: rotate(90deg); }
.agy-disclosure-body { padding-bottom: 8px; }
/* One row per reasoning level: label, then the budget input. The input is
   width-capped so the empty state reads as "no value set" rather than as a wide
   field waiting to be filled. */
/* Label | input | chips. Two content columns plus shortcuts, with real vertical
   breathing room: the earlier three-column version (label | input | a sentence
   restating the row's own label) packed four rows into 5px padding and 10px gaps,
   which read as one solid block. */
.agy-thinking-group { display: flex; flex-direction: column; }
.agy-thinking-group + .agy-thinking-group { margin-top: 16px; }
.agy-thinking-group-name {
  font: var(--dsw-font-xxs-strong-12); color: ${aliasVar("label-secondary")};
  margin-bottom: 2px;
}
.agy-thinking-group .agy-hint { margin: 0 0 8px; }
/* The four things a reader can actually DO with this setting. A list, because
   each is an independent action, and prose buried them. */
.agy-thinking-effects { margin: 2px 0 10px; }
/* Claude's three differences, as a list: each is an independent axis, and the
   last one is why that group has no reference table. */
.agy-thinking-notes { margin: 0 0 8px; padding-left: 18px; }
.agy-thinking-notes li {
  font: var(--dsw-font-xxxs-11); color: ${aliasVar("label-tertiary")};
  line-height: 1.6;
}
.agy-thinking-row {
  display: grid; grid-template-columns: 72px minmax(0, 180px) auto;
  align-items: center; gap: 14px; padding: 8px 0;
}
.agy-thinking-k { font: var(--dsw-font-xxs-12); color: ${aliasVar("label-secondary")}; }
/* The unit sits INSIDE the third column, left of the chips: that auto column is
   what holds "what the number counts" next to the field it counts, and a unit
   drifting to the input's far edge would read as a separate label. */
.agy-input-unit { display: flex; align-items: center; gap: 8px;
  font: var(--dsw-font-xxs-12); color: ${aliasVar("label-tertiary")}; }
/* Shortcut chips, not a second control: they fill the field beside them. */
.agy-thinking-chips { display: flex; gap: 6px; }
.agy-thinking-chip {
  border: 0.5px solid ${aliasVar("border-l3")};
  background: transparent; cursor: pointer; border-radius: 10px;
  padding: 2px 8px; font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-secondary")};
}
.agy-thinking-chip:hover { background: ${aliasVar("interactive-bg-hover")}; }
.agy-thinking-chip:focus-visible {
  outline: 2px solid ${aliasVar("brand-primary")}; outline-offset: 1px;
}
.agy-disclosure-meta { margin-left: auto; font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")}; font-variant-numeric: tabular-nums; }

/* ── 5h / weekly limits ────────────────────────────────────────────────────
   One group per upstream group (Gemini, Claude+GPT), each with its windows.
   The rows are a fixed 4-column grid so the bars and the percentages line up
   across groups: label / bar / percentage / reset countdown. */
.agy-limits { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.agy-limit-age { font: var(--dsw-font-xxxs-11); color: ${aliasVar("label-tertiary")}; }
.agy-limit-group { display: flex; flex-direction: column; gap: 2px; }
.agy-limit-group-name {
  font: var(--dsw-font-xxs-strong-12); color: ${aliasVar("label-secondary")};
  padding-bottom: 2px;
}
.agy-limit-row {
  display: grid; grid-template-columns: 58px minmax(0,1fr) 40px minmax(0,auto);
  align-items: center; gap: 10px; padding: 4px 0;
  font: var(--dsw-font-xxs-12);
}
.agy-limit-k { color: ${aliasVar("label-secondary")}; }
.agy-limit-track { height: 6px; border-radius: 3px; overflow: hidden;
  background: ${aliasVar("border-l2")}; }
.agy-limit-track i { display: block; height: 100%; border-radius: 3px; }
.agy-limit-p { text-align: right; font-variant-numeric: tabular-nums;
  color: ${aliasVar("label-primary")}; }
.agy-limit-reset { text-align: right; font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")}; }
/* The burn projection: indented to align with the bar (58px label + 10px gap),
   warn-tinted because "this window runs dry before it resets" is the one
   projection that asks the reader to act. */
.agy-limit-burn { padding: 0 0 4px 68px;
  font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("state-warn-primary")}; }

/* ── Dense breakdown tables (Usage tab only) ─────────────────────────────── */
.agy-table-wrap { padding: 6px 0 2px; }
.agy-table { width: 100%; border-collapse: collapse; font: var(--dsw-font-xs-13); table-layout: fixed; }
.agy-table th {
  text-align: left; padding: 0 8px 7px; font: var(--dsw-font-xxxs-strong-11);
  color: ${aliasVar("label-tertiary")};
  border-bottom: 0.5px solid ${aliasVar("border-l2")}; white-space: nowrap;
}
.agy-table td { padding: 8px; vertical-align: middle; color: ${aliasVar("label-secondary")};
  border-bottom: 0.5px solid ${aliasVar("border-l1")}; }
.agy-table tr:last-child td { border-bottom: 0; }
.agy-table tbody tr:hover td { background: ${aliasVar("bg-layer-2")}; }
.agy-num { text-align: right; font-variant-numeric: tabular-nums; }
/* Numeric HEADERS must right-align too, and .agy-num alone cannot do it: the
   .agy-table th rule above is specificity 0-1-1 and outranks the bare .agy-num
   class (0-1-0), so every numeric th stayed left while its td cells
   right-aligned — the header label sat at the column's left edge with its
   figure out at the right, which is what read as "the data is skewed right".
   Matching the cell class on the header element (0-2-1) wins instead of
   escalating with !important. */
.agy-table th.agy-num { text-align: right; }
/* Inline emphasis on a table cell: a strong role, not a heavier size. */
.agy-strong { color: ${aliasVar("label-primary")}; font-weight: 500; }
.agy-mail { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agy-mono { font-family: var(--ds-font-family-code); }
/* The one external link in the section (a verification appeal URL). Colored and
   underlined with theme tokens rather than left to the browser default, which
   ignores both the light/dark theme and the host's brand color. */
.agy-link { color: ${aliasVar("brand-primary")}; text-decoration: underline; }
.agy-link:hover { opacity: 0.8; }

.agy-bar { display: inline-flex; align-items: center; gap: 8px; justify-content: flex-end; }
.agy-bar .agy-track { width: 56px; height: 4px; border-radius: 2px; overflow: hidden;
  background: ${aliasVar("border-l2")}; }
.agy-bar .agy-track i { display: block; height: 100%; border-radius: 2px;
  background: ${aliasVar("brand-primary")}; }

/* ── Range picker container ────────────────────────────────────────────────
   The pills themselves are the host Pill primitive (its own fill pair and
   active state); this only lays them out in a row. */
.agy-chips { display: flex; gap: 6px; }

/* Danger has no primitive variant; keep the ghost skin and tint the label. */
.agy-btn-danger { color: ${aliasVar("state-error-primary")} !important; }

/* ── Recent activity ring ──────────────────────────────────────────────────
   The "what just happened" list. Only the result cell carries color — ok
   inherits the table's neutral, and a wall of tinted rows would read as an
   alarm rather than a log. */
.agy-recent-state { font: var(--dsw-font-xxs-12); }
.agy-recent-state[data-kind="fail"] { color: ${aliasVar("state-error-primary")}; }
.agy-recent-state[data-kind="limited"] { color: ${aliasVar("state-warn-primary")}; }
.agy-recent-state[data-kind="rotation"] { color: ${aliasVar("brand-primary")}; }
/* The recent list is a standalone disclosure on the tab root, not one block
   inside a card body — the separator border-top the disclosure idiom uses
   between sibling blocks would draw a stray line across nothing here. */
.agy-recent.agy-disclosure { border-top: 0; }

.agy-toolbar { display: flex; align-items: center; gap: 8px; }
.agy-textarea { width: 100%; min-height: 88px; resize: vertical; outline: none;
  padding: 9px 10px; font: var(--dsw-font-xxs-12); font-family: var(--ds-font-family-code);
  color: ${aliasVar("label-primary")}; background: ${aliasVar("bg-layer-1")};
  border: 0.5px solid ${aliasVar("border-l2")}; border-radius: 8px; }
.agy-textarea:focus { border-color: ${aliasVar("brand-primary")}; }

/* ── Preferences card ───────────────────────────────────────────────────── */
.agy-pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
}
.agy-pref-row + .agy-pref-row {
  border-top: 0.5px solid ${aliasVar("border-l1")};
  padding-top: 10px;
}
.agy-pref-name {
  font: var(--dsw-font-xs-strong-13);
  color: ${aliasVar("label-primary")};
}
.agy-pref-desc {
  font: var(--dsw-font-xxs-12);
  color: ${aliasVar("label-tertiary")};
  margin-top: 2px;
}

/* ── Conversation-header quota badge & popover ─────────────────────────── */
.agy-ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${aliasVar("bg-layer-2")};
  border: 0.5px solid ${aliasVar("border-l2")};
  border-radius: 9999px;
  padding: 3px 10px;
  font: var(--dsw-font-xxs-12);
  color: ${aliasVar("label-primary")};
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  height: auto;
}

.agy-ui-badge:hover,
.agy-ui-badge.pinned {
  background: ${aliasVar("bg-layer-3")};
  border-color: ${aliasVar("border-l1")};
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
}

.agy-ui-badge.pinned {
  border-color: ${aliasVar("brand-primary")};
  box-shadow: 0 0 0 1px ${aliasVar("brand-primary")}, 0 3px 10px rgba(0, 0, 0, 0.12);
}

.agy-ui-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background-color 0.3s;
}

.agy-ui-dot[data-state="done"],
.agy-ui-dot.active {
  background-color: ${aliasVar("state-success-primary")};
  box-shadow: 0 0 6px ${aliasVar("state-success-primary")};
}

.agy-ui-dot[data-state="warning"],
.agy-ui-dot.cooling {
  background-color: ${aliasVar("state-warn-primary")};
  box-shadow: 0 0 6px ${aliasVar("state-warn-primary")};
}

.agy-ui-dot[data-state="idle"],
.agy-ui-dot.disabled {
  background-color: ${aliasVar("label-tertiary")};
}

.agy-ui-dot.updating {
  animation: agy-ui-pulse 1.2s ease-in-out infinite;
}

.agy-ui-dot.active.updating,
.agy-ui-dot[data-state="done"].updating {
  box-shadow: 0 0 10px ${aliasVar("state-success-primary")};
}

.agy-ui-dot.cooling.updating,
.agy-ui-dot[data-state="warning"].updating {
  box-shadow: 0 0 10px ${aliasVar("state-warn-primary")};
}

@keyframes agy-ui-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.7);
  }
}

.agy-ui-sparkle {
  color: ${aliasVar("brand-primary")};
  font: var(--dsw-font-xs-13);
}

.agy-ui-popover-container.desktop {
  position: static;
}

.agy-ui-popover-container.mobile {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: agy-ui-fade-in 0.2s ease-out;
}

.agy-ui-popover {
  background: ${aliasVar("bg-overlay")};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 0.5px solid ${aliasVar("border-l2")};
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.15), 0 0 0 0.5px ${aliasVar("border-l1")};
  color: ${aliasVar("label-primary")};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  z-index: 1000;
}

.agy-ui-popover.desktop {
  width: 380px;
  max-width: calc(100vw - 24px);
  border-radius: 14px;
  animation: agy-ui-popover-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.agy-ui-popover.mobile {
  width: 100%;
  max-height: 82vh;
  border-radius: 20px 20px 0 0;
  border-bottom: none;
  animation: agy-ui-bottom-sheet-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.agy-ui-mobile-handle {
  width: 36px;
  height: 4px;
  background: ${aliasVar("border-l2")};
  border-radius: 9999px;
  margin: 8px auto 2px auto;
}

@keyframes agy-ui-popover-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes agy-ui-bottom-sheet-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes agy-ui-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.agy-ui-modal-header {
  padding: 10px 14px;
  border-bottom: 0.5px solid ${aliasVar("border-l2")};
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${aliasVar("bg-layer-1")};
}

.agy-ui-modal-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font: var(--dsw-font-xs-strong-13);
  color: ${aliasVar("label-primary")};
}

.agy-ui-pinned-tag {
  font: var(--dsw-font-xxxs-11);
  margin-left: 2px;
}

.agy-ui-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.agy-ui-icon-btn {
  color: ${aliasVar("label-secondary")};
  padding: 4px;
  min-width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.agy-ui-icon-btn:hover {
  color: ${aliasVar("label-primary")};
  background: ${aliasVar("bg-layer-2")};
}

.agy-ui-icon-btn.active {
  color: ${aliasVar("brand-primary")};
  background: color-mix(in srgb, ${aliasVar("brand-primary")} 18%, transparent);
}

.agy-ui-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.agy-ui-spinning {
  animation: agy-ui-spin 1s linear infinite;
}

@keyframes agy-ui-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.agy-ui-modal-body {
  padding: 14px 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
}

.agy-ui-account-card {
  background: ${aliasVar("bg-layer-2")};
  border: 0.5px solid ${aliasVar("border-l1")};
  border-radius: 9px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agy-ui-account-email {
  font: var(--dsw-font-xxs-12);
  color: ${aliasVar("label-primary")};
}

.agy-ui-account-project {
  font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")};
  margin-top: 2px;
}

.agy-ui-state-pill {
  font: var(--dsw-font-xxxs-11);
  padding: 2px 7px;
  border-radius: 9999px;
  text-transform: capitalize;
}

.agy-ui-state-pill.active {
  background: color-mix(in srgb, ${aliasVar("state-business-primary")} 15%, transparent);
  color: ${aliasVar("state-business-primary")};
  border: 0.5px solid color-mix(in srgb, ${aliasVar("state-business-primary")} 30%, transparent);
}

.agy-ui-state-pill.cooling {
  background: color-mix(in srgb, ${aliasVar("state-error-secondary")} 15%, transparent);
  color: ${aliasVar("state-error-secondary")};
  border: 0.5px solid color-mix(in srgb, ${aliasVar("state-error-secondary")} 30%, transparent);
}

.agy-ui-state-pill.verification-required {
  background: color-mix(in srgb, ${aliasVar("brand-primary")} 15%, transparent);
  color: ${aliasVar("brand-primary")};
  border: 0.5px solid color-mix(in srgb, ${aliasVar("brand-primary")} 30%, transparent);
}

.agy-ui-state-pill.disabled {
  background: color-mix(in srgb, ${aliasVar("label-tertiary")} 15%, transparent);
  color: ${aliasVar("label-secondary")};
  border: 0.5px solid color-mix(in srgb, ${aliasVar("label-tertiary")} 30%, transparent);
}

.agy-ui-section-label {
  font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")};
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.agy-ui-quota-card {
  background: ${aliasVar("bg-layer-2")};
  border: 0.5px solid ${aliasVar("border-l1")};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agy-ui-quota-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.agy-ui-model-name {
  font: var(--dsw-font-xxs-12);
  color: ${aliasVar("label-primary")};
}

.agy-ui-limit-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.agy-ui-limit-row + .agy-ui-limit-row {
  margin-top: 5px;
}

.agy-ui-limit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font: var(--dsw-font-xxxs-11);
}

.agy-ui-limit-title {
  color: ${aliasVar("label-secondary")};
  font: var(--dsw-font-xxxs-11);
}

.agy-ui-limit-percent {
  font: var(--dsw-font-xxs-12);
  font-variant-numeric: tabular-nums;
}

.agy-ui-progress-track {
  width: 100%;
  height: 5px;
  background: color-mix(in srgb, ${aliasVar("label-primary")} 8%, transparent);
  border-radius: 9999px;
  overflow: hidden;
}

.agy-ui-progress-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.agy-ui-quota-footer {
  display: flex;
  justify-content: flex-end;
  font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")};
  font-variant-numeric: tabular-nums;
}

.agy-ui-modal-footer {
  padding: 8px 14px;
  border-top: 0.5px solid ${aliasVar("border-l2")};
  background: ${aliasVar("bg-layer-1")};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")};
}

.agy-ui-window-note {
  font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")};
  margin-top: 3px;
  padding: 8px 0;
}

.agy-ui-limit-age {
  font: var(--dsw-font-xxxs-11);
  color: ${aliasVar("label-tertiary")};
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.agy-ui-verify-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font: var(--dsw-font-xxs-12);
  color: ${aliasVar("brand-primary")};
  background: color-mix(in srgb, ${aliasVar("brand-primary")} 10%, transparent);
  border: 0.5px solid color-mix(in srgb, ${aliasVar("brand-primary")} 30%, transparent);
  border-radius: 9999px;
  padding: 6px 12px;
}

.agy-ui-link-btn {
  color: ${aliasVar("brand-primary")};
  text-decoration: none;
  font: var(--dsw-font-xxs-12);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: color 0.15s;
  background: none;
  border: none;
  padding: 0;
}

.agy-ui-link-btn:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .agy-ui-badge {
    padding: 2px 7px;
    font: var(--dsw-font-xxxs-11);
    gap: 4px;
  }
  .agy-ui-modal-body {
    padding: 12px 14px;
    gap: 10px;
  }
}
`;
		/** Install the stylesheet once (idempotent across plugin reloads): a second
		*  install never appends a duplicate, and one whose content has gone stale
		*  (a previous bundle's CSS) is refreshed in place. The disposer is
		*  deliberately a NO-OP — it runs on every Cordis effect re-evaluation, and
		*  removing the element there stripped every .agy-* style mid-session; the
		*  element is unique by id and inert once the section is gone. */
		function installAgyStyles() {
			if (typeof document === "undefined") return () => {};
			const existing = document.getElementById(STYLE_ID);
			if (existing !== null) {
				if (existing.textContent !== AGY_STYLES_CSS) existing.textContent = AGY_STYLES_CSS;
				return () => {};
			}
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = AGY_STYLES_CSS;
			document.head.appendChild(style);
			return () => {};
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Bilingual copy for the agy Settings section.
		*
		* Registered through the host's locale service (`ctx.locale.register`), so the
		* section follows DSH's own language setting instead of carrying a private
		* language switch. Keys are typed, and the `zh` and `en` dictionaries must stay
		* key-for-key identical (a test enforces it).
		*/
		const zh = {
			title: "Antigravity",
			subtitle: "账号轮换、模型可见性、用量与凭据",
			refresh: "刷新",
			login: "登录",
			loading: "加载中…",
			tabAccounts: "账号",
			tabModels: "模型",
			tabConfig: "配置",
			tabUsage: "用量",
			tabCredentials: "凭据",
			stateActive: "可用",
			stateCooling: "冷却中",
			stateVerificationRequired: "待验证",
			stateDisabled: "已停用",
			coolingUntil: "冷却至",
			verificationRetry: "待验证 · {time} 重试",
			currentAccount: "当前账号",
			fieldDisabled: "停用",
			disabledCredentials: "凭据失效",
			disabledSince: "停用于 {ago}",
			disabledHint: "凭据已被上游拒绝。运行该账号所在行的「验证」尝试恢复；若仍失败，请重新登录导入。",
			noProject: "—",
			valueUnknown: "—",
			colAccount: "账号",
			colRequests: "请求",
			colTime: "时间",
			colResult: "结果",
			colDuration: "耗时",
			recentTitle: "最近请求",
			recentEmpty: "暂无最近记录",
			recentOk: "成功",
			rowRequestsTotal: "累计请求 {n}",
			lastActive: "{ago}活跃",
			liveOne: "正在通过 {email} 生成 · {count} 个并发",
			liveMany: "正在生成 · {count} 个并发 · {accounts} 个账号",
			fieldThroughput: "吞吐",
			throughputValue: "≈ {n} token/s",
			throughputNote: "首 token 后 · 累计平均",
			colActions: "操作",
			emptyAccounts: "还没有账号。切到「凭据」标签导入，或点击上方「登录」。",
			detailTitle: "已选账号",
			limitsTitle: "限额",
			limitsUnavailable: "尚未测量。配额按账号定期刷新后显示。",
			limitsMeasured: "测量于 {ago}",
			limitsRefreshOk: "已刷新 {measured} 个账号的限额",
			limitsRefreshFresh: "限额仍是新鲜的，无需刷新",
			limitsRefreshFailed: "{failed} 个账号的限额刷新失败",
			limitBurnWarn: "按此速度{value}后耗尽",
			quotaWindow5h: "5 小时",
			quotaWindowWeekly: "每周",
			quotaWindowDaily: "每日",
			quotaWindowMonthly: "每月",
			quotaResetPassed: "已重置",
			quotaStaleNote: "该窗口已重置，等待下次刷新",
			quotaUnmeasuredNote: "上游未返回该窗口的剩余额度",
			quotaGroupFallback: "配额分组",
			badgeTitle: "Antigravity 配额状态",
			badgeAria: "Antigravity 配额",
			badgeHint: "固定弹窗",
			badgeUnpinHint: "取消固定",
			badgeRefreshHint: "刷新配额状态",
			badgePinned: "已固定",
			badgeClose: "关闭",
			badgeReading: "{window}剩余 {percent}%",
			badgeUnmeasured: "尚未测量",
			badgeNoAccount: "未检测到活跃账号，请前往设置页登录",
			badgeSectionMonitor: "额度监控 (5小时 / 日 / 周 / 月)",
			badgeVerifyRequired: "该账号被要求验证身份",
			badgeAppealLink: "打开申诉链接 ↗",
			badgeNoQuotaData: "暂无额度数据，点击右上角刷新重新测量",
			badgeMeasuredAt: "额度测量于 {time}",
			badgeTooltip: "Antigravity: {count} 个账号 · {reading} · 悬停或点击查看配额详情",
			quotaSourceCaption: "数据来源: dsh-agy 分组额度",
			quotaManageHint: "管理入口: 设置 → Antigravity",
			prefConversationBadge: "会话顶栏配额胶囊",
			prefConversationBadgeDesc: "在聊天会话顶栏显示当前账号配额与水位状态浮层",
			prefSaveFailed: "保存失败：{message}",
			prefDetailedQuotaReset: "高精度配额重置倒计时",
			prefDetailedQuotaResetDesc: "在设置面板与顶栏浮层中显示精确的重置倒计时（5 小时额度显示小时与分钟，每周额度显示具体日期与倒计时）",
			badgeReset5hHoursMins: "{hours}小时{mins}分后重置",
			badgeReset5hMins: "{mins}分钟后重置",
			badgeCountdownDaysHours: "{days}天{hours}小时后",
			badgeCountdownDays: "{days}天后",
			badgeCountdownHours: "{hours}小时后",
			badgeCountdownMins: "{mins}分钟后",
			badgeResetFullDate: "{month}月{day}日 {time} ({countdown})",
			badgeQuotaFormat: "AGY · {percent}%",
			badgeWindowQuotaFormat: "AGY · {window}{percent}%",
			badgeCountFormat: "AGY ✦ {count}",
			fieldProject: "项目",
			fieldProxy: "代理",
			fieldFingerprint: "指纹",
			fieldCooldownReason: "冷却原因",
			cooldownReasonNetworkError: "网络错误",
			cooldownReasonQuotaExhausted: "额度耗尽",
			cooldownReasonValidationRequired: "需要验证",
			cooldownReasonProjectError: "项目错误",
			reasonAborted: "已取消",
			fieldSources: "调用来源",
			fieldLatency: "延迟",
			fieldVerification: "验证",
			verificationOpen: "前往验证",
			verificationNoUrl: "上游未提供链接，请在 Antigravity 中完成验证",
			labelLatencyAverage: "平均延迟",
			labelTtft: "首 token",
			proxyPlaceholder: "socks5://host:port",
			proxyDirect: "未配置（直连）",
			fingerprintNone: "未生成",
			fingerprintRegenerated: "已重建 {count} 次 · {date}",
			latencyAverage: "平均 {value}",
			latencyTtft: "首 token {value}",
			sourcesSummary: "对话 {chat} · CLI {cli} · 验证 {verify} · 测试 {test}",
			quotaResetIn: "重置 {value}",
			relNow: "即将",
			relJustNow: "刚刚",
			relSeconds: "{n} 秒",
			relAgo: "{value}前",
			relMinutes: "{n} 分钟",
			relHours: "{n} 小时",
			relDays: "{n} 天",
			relMonths: "{n} 个月",
			relYears: "{n} 年",
			actionActivate: "设为当前",
			actionVerify: "验证",
			actionDelete: "删除",
			actionTest: "测试调用",
			actionExport: "导出 Blob",
			actionRegenerateFingerprint: "重置指纹",
			actionSave: "保存",
			actionClear: "清除",
			actionTestProxy: "测试",
			actionTestModel: "测试",
			modelTesting: "测试中…",
			modelTestOk: "{model} 可用。",
			modelTestFail: "{model} 测试失败：",
			proxyTestOk: "代理可达：{proxy}",
			proxyTestFail: "代理不可达：{proxy}",
			proxyTestNoTarget: "先填写代理地址，或保存一个代理",
			verifyOk: "凭证有效：{email}",
			verifyFail: "验证失败：",
			confirmDelete: "删除这个账号？此操作不可撤销。",
			noModelToTest: "没有可用于测试的模型",
			exportFailed: "导出失败",
			importResult: "导入 {imported} 个，覆盖 {replaced} 个。",
			importPartial: "导入 {imported} 个，覆盖 {replaced} 个，失败 {failed} 个：",
			usageCumulative: "用量 · 累计",
			usageTitle: "用量",
			kpiTotalTokens: "总 Token",
			kpiTotalDetail: "{requests} 次请求 · 失败 {failed}",
			kpiInput: "输入",
			kpiOutput: "输出",
			kpiCacheRead: "缓存命中",
			kpiRequests: "请求",
			kpiInputMissed: "未命中 {tokens}",
			kpiInputMissedLabel: "未命中",
			kpiOutputDetail: "含推理",
			kpiCacheHit: "占输入 {percent}%",
			kpiNoBilledInput: "无计费输入",
			kpiRequestsDetail: "成功 {succeeded} · 失败 {failed}",
			fieldCacheWrite: "缓存写",
			fieldRateLimitRotation: "限流 / 轮换",
			byModel: "按模型",
			byAccount: "按账号",
			trendTitle: "近 7 天",
			colDay: "日期",
			colModel: "模型",
			colTokenShare: "Token 占比",
			colOutput: "输出",
			colToken: "Token",
			colFailed: "失败",
			colRateLimited: "限流",
			colRotations: "轮换",
			rangeToday: "今日",
			rangeWeek: "7 天",
			rangeMonth: "30 天",
			rangeAll: "全部",
			since: "自 {date} 起",
			emptyUsage: "还没有用量记录。",
			thinkingTitle: "思考预算",
			thinkingDefaultAll: "默认",
			thinkingConfigured: "{count} 项已设置",
			thinkingLevelLow: "低",
			thinkingLevelMedium: "中",
			thinkingLevelHigh: "高",
			thinkingAuto: "默认",
			thinkingChipClear: "清空",
			thinkingGeminiGroup: "Gemini",
			thinkingGeminiHint: "思考预算是 API 里的一个隐藏参数，用来控制模型思考的努力程度。上游给其中几个取值起了名字，这就是你在模型选择器里看到的 reasoning effort（high / medium / low）。填入预算会替换掉原本的 high / medium / low 传给模型，而不是叠加。",
			thinkingEffectLowUp: "让低档想得更多：在 Low 行填入较大数值",
			thinkingEffectHighDown: "让高档想得更少（更快、更省）：在 High 行填入较小数值",
			thinkingEffectMax: "获得最大思考：直接选 High，不必填值",
			thinkingEffectReset: "恢复该档默认：清空该行",
			thinkingEffectProLevels: "Pro 系列仅提供低档与高档（中档仅对 Flash 系列有效）",
			thinkingTieredLabel: "Default",
			thinkingSamplesTitle: "实测思考量参考",
			thinkingSamplesIntro: "模型会基于预算，根据问题难度自适应调整思考长短。",
			thinkingSamplesCaption: "这张表格展示了测试中，Gemini 3.8 Flash 在不同预算下，对不同难度题目的实际思考消耗（单位：token）。",
			thinkingSamplesComparison: "填入最大值（65535）与选 High 在困难题上完全相同，但可以提高简单题和中等题的思考程度（约 10–15%）。数值决定效果——同一数值填在任意一行，发出的请求完全相同。",
			thinkingSamplesSources: "注：困难题使用一道组合计数推导题（推导铺砖递推式并求第 40 项），中等题使用一道数论证明题（证明 n⁴+4 恒为合数），简单题使用一道两位数乘法。",
			thinkingSamplesZero: "Low 档在中等题上确实不产生思考（多次实测为 0），并非数据缺失——同一道题上 Medium 与 High 均正常思考。",
			thinkingSamplesLevel: "设置",
			thinkingSamplesEasy: "简单题",
			thinkingSamplesMedium: "中等题",
			thinkingSamplesHard: "困难题",
			thinkingSamplesMaxRow: "填入 65535",
			thinkingClaudeGroup: "Claude",
			thinkingClaudeLabel: "预算",
			thinkingClaudeNoLevels: "无思考等级，只有一个预算值（{min}–{max}）。",
			thinkingClaudeMaxTokens: "必须小于单次回复上限，否则不发送。",
			thinkingClaudeNoReport: "上游不回报实际思考量，故无参考表。",
			thinkingInvalid: "请填整数。",
			multimodalTitle: "多模态内联上限",
			multimodalLabel: "单文件上限",
			multimodalUnit: "MB",
			multimodalAuto: "默认",
			multimodalClear: "清除",
			multimodalHint: "超过上限的文件不会被内联发送，但它的文件句柄仍留在对话里，模型依然可以用文件工具读取。",
			multimodalInvalid: "请填整数。",
			multimodalRange: "请填 {min}–{max} 之间的整数。",
			multimodalSourceDefault: "未设置 · 默认 {default} MB",
			multimodalSourceStored: "已保存的设置生效中",
			multimodalSourceEnv: "环境变量 DSH_AGY_MULTIMODAL_MAX_INLINE_MB 优先于此处设置。",
			modelsTitle: "模型可见性",
			modelsHelp: "关闭开关后，该模型不再出现在对话框的模型选择里。黑名单制：只有被关闭的才隐藏，服务端新增的模型一律默认显示。",
			modelsHiddenSuffix: "当前已隐藏 {count} 个。",
			modelToggleAria: "{name} 是否在模型选择中显示",
			emptyModels: "没有可用模型。先登录一个账号。",
			importTitle: "导入凭据",
			importHelp: "粘贴 agy auth.json，或 dsh-agy login --blob 生成的凭据 blob；多行可批量导入。",
			importPlaceholder: "{\"token\":{\"access_token\":\"...\",\"refresh_token\":\"...\"}} 或 dsh-agy-cred-v1....（每行一个）",
			importJson: "导入 JSON",
			importBlob: "导入 Blob",
			exportAll: "导出全部"
		};
		const en = {
			title: "Antigravity",
			subtitle: "Account rotation, model visibility, usage, and credentials",
			refresh: "Refresh",
			login: "Sign in",
			loading: "Loading…",
			tabAccounts: "Accounts",
			tabModels: "Models",
			tabConfig: "Config",
			tabUsage: "Usage",
			tabCredentials: "Credentials",
			stateActive: "Ready",
			stateCooling: "Cooling down",
			stateVerificationRequired: "Needs verification",
			stateDisabled: "Disabled",
			coolingUntil: "Cooling until",
			verificationRetry: "Needs verification · retries {time}",
			currentAccount: "Current",
			fieldDisabled: "Disabled",
			disabledCredentials: "Credentials rejected",
			disabledSince: "disabled {ago}",
			disabledHint: "The credentials were rejected by upstream. Run Verify on this account's row to try restoring it; if that fails, sign in again to re-import.",
			noProject: "—",
			valueUnknown: "—",
			colAccount: "Account",
			colRequests: "Requests",
			colTime: "Time",
			colResult: "Result",
			colDuration: "Duration",
			recentTitle: "Recent requests",
			recentEmpty: "No recent activity",
			recentOk: "ok",
			rowRequestsTotal: "{n} requests in total",
			lastActive: "active {ago}",
			liveOne: "Generating via {email} · {count} in flight",
			liveMany: "Generating · {count} in flight across {accounts} account(s)",
			fieldThroughput: "Throughput",
			throughputValue: "≈ {n} token/s",
			throughputNote: "after first token · cumulative",
			colActions: "Actions",
			emptyAccounts: "No accounts yet. Import one from the Credentials tab, or use Sign in above.",
			detailTitle: "Selected account",
			limitsTitle: "Limits",
			limitsUnavailable: "Not measured yet. Windows appear after the quota refresh runs for this account.",
			limitsMeasured: "measured {ago}",
			limitsRefreshOk: "Refreshed limits for {measured} account(s)",
			limitsRefreshFresh: "Limits are already fresh — nothing to refresh",
			limitsRefreshFailed: "Limit refresh failed for {failed} account(s)",
			limitBurnWarn: "at this rate, empty in {value}",
			quotaWindow5h: "5 hours",
			quotaWindowWeekly: "Weekly",
			quotaWindowDaily: "Daily",
			quotaWindowMonthly: "Monthly",
			quotaResetPassed: "already reset",
			quotaStaleNote: "This window has already reset — waiting for the next refresh",
			quotaUnmeasuredNote: "Upstream reported no remaining fraction for this window",
			quotaGroupFallback: "Quota group",
			badgeTitle: "Antigravity quota status",
			badgeAria: "Antigravity quota",
			badgeHint: "Pin modal",
			badgeUnpinHint: "Unpin modal",
			badgeRefreshHint: "Refresh quota status",
			badgePinned: "Pinned",
			badgeClose: "Close",
			badgeReading: "{window} {percent}% left",
			badgeUnmeasured: "not measured yet",
			badgeNoAccount: "No active account, please login in Settings",
			badgeSectionMonitor: "Quota monitor (5h / Daily / Weekly / Monthly)",
			badgeVerifyRequired: "Account verification required",
			badgeAppealLink: "Open appeal link ↗",
			badgeNoQuotaData: "No quota data yet, click refresh in top right to measure",
			badgeMeasuredAt: "Limits measured {time}",
			badgeTooltip: "Antigravity: {count} accounts · {reading} · Hover or click to view quota details",
			quotaSourceCaption: "Source: dsh-agy grouped limits",
			quotaManageHint: "Manage: Settings → Antigravity",
			prefConversationBadge: "Conversation header quota badge",
			prefConversationBadgeDesc: "Display active account quota badge and popover in conversation session header",
			prefSaveFailed: "Save failed: {message}",
			prefDetailedQuotaReset: "Detailed quota reset countdown",
			prefDetailedQuotaResetDesc: "Show detailed reset countdown in both settings and header badge (hours and minutes for 5h, full date and countdown for weekly)",
			badgeReset5hHoursMins: "resets in {hours}h {mins}m",
			badgeReset5hMins: "resets in {mins}m",
			badgeCountdownDaysHours: "{days}d {hours}h later",
			badgeCountdownDays: "{days}d later",
			badgeCountdownHours: "{hours}h later",
			badgeCountdownMins: "{mins}m later",
			badgeResetFullDate: "{month}/{day} {time} ({countdown})",
			badgeQuotaFormat: "AGY · {percent}%",
			badgeWindowQuotaFormat: "AGY · {window}{percent}%",
			badgeCountFormat: "AGY ✦ {count}",
			fieldProject: "Project",
			fieldProxy: "Proxy",
			fieldFingerprint: "Fingerprint",
			fieldCooldownReason: "Cooldown reason",
			cooldownReasonNetworkError: "network error",
			cooldownReasonQuotaExhausted: "quota exhausted",
			cooldownReasonValidationRequired: "verification required",
			cooldownReasonProjectError: "project error",
			reasonAborted: "cancelled",
			fieldSources: "Call sources",
			fieldLatency: "Latency",
			fieldVerification: "Verification",
			verificationOpen: "Verify now",
			verificationNoUrl: "No link from upstream — complete verification in Antigravity",
			labelLatencyAverage: "Average latency",
			labelTtft: "First token",
			proxyPlaceholder: "socks5://host:port",
			proxyDirect: "Not configured (direct)",
			fingerprintNone: "Not generated",
			fingerprintRegenerated: "Regenerated {count}× · {date}",
			latencyAverage: "avg {value}",
			latencyTtft: "first token {value}",
			sourcesSummary: "chat {chat} · CLI {cli} · verify {verify} · test {test}",
			quotaResetIn: "resets {value}",
			relNow: "shortly",
			relJustNow: "just now",
			relSeconds: "{n}s",
			relAgo: "{value} ago",
			relMinutes: "{n} min",
			relHours: "{n} h",
			relDays: "{n} d",
			relMonths: "{n} mo",
			relYears: "{n} y",
			actionActivate: "Set as current",
			actionVerify: "Verify",
			actionDelete: "Delete",
			actionTest: "Test call",
			actionExport: "Export blob",
			actionRegenerateFingerprint: "Reset fingerprint",
			actionSave: "Save",
			actionClear: "Clear",
			actionTestProxy: "Test",
			actionTestModel: "Test",
			modelTesting: "Testing…",
			modelTestOk: "{model} is working.",
			modelTestFail: "{model} test failed:",
			proxyTestOk: "Proxy reachable: {proxy}",
			proxyTestFail: "Proxy unreachable: {proxy}",
			proxyTestNoTarget: "Enter a proxy address, or save one first",
			verifyOk: "Credentials valid: {email}",
			verifyFail: "Verification failed:",
			confirmDelete: "Delete this account? This cannot be undone.",
			noModelToTest: "No model available to test",
			exportFailed: "Export failed",
			importResult: "Imported {imported}, replaced {replaced}.",
			importPartial: "Imported {imported}, replaced {replaced}, {failed} failed:",
			usageCumulative: "Usage · cumulative",
			usageTitle: "Usage",
			kpiTotalTokens: "Total tokens",
			kpiTotalDetail: "{requests} requests · {failed} failed",
			kpiInput: "Input",
			kpiOutput: "Output",
			kpiCacheRead: "Cache hit",
			kpiRequests: "Requests",
			kpiInputMissed: "{tokens} missed",
			kpiInputMissedLabel: "Missed",
			kpiOutputDetail: "incl. reasoning",
			kpiCacheHit: "{percent}% of input",
			kpiNoBilledInput: "no billed input",
			kpiRequestsDetail: "{succeeded} ok · {failed} failed",
			fieldCacheWrite: "Cache write",
			fieldRateLimitRotation: "Rate limits / rotations",
			byModel: "By model",
			byAccount: "By account",
			trendTitle: "Last 7 days",
			colDay: "Day",
			colModel: "Model",
			colTokenShare: "Token share",
			colOutput: "Output",
			colToken: "Tokens",
			colFailed: "Failed",
			colRateLimited: "Rate ltd",
			colRotations: "Rotations",
			rangeToday: "Today",
			rangeWeek: "7 days",
			rangeMonth: "30 days",
			rangeAll: "All",
			since: "since {date}",
			emptyUsage: "No usage recorded yet.",
			thinkingTitle: "Thinking budget",
			thinkingDefaultAll: "default",
			thinkingConfigured: "{count} set",
			thinkingLevelLow: "Low",
			thinkingLevelMedium: "Medium",
			thinkingLevelHigh: "High",
			thinkingAuto: "default",
			thinkingChipClear: "Clear",
			thinkingGeminiGroup: "Gemini",
			thinkingGeminiHint: "A thinking budget is a hidden parameter in the API that controls how hard the model thinks. Upstream gives a few of its values names, and those names are what you see as reasoning effort (high / medium / low) in the model picker. A budget replaces the high / medium / low value that would otherwise be sent, rather than stacking with it.",
			thinkingEffectLowUp: "Make a low tier think more: put a larger value on the Low row",
			thinkingEffectHighDown: "Make a high tier think less (faster, cheaper): put a smaller value on the High row",
			thinkingEffectMax: "Maximum thinking: just select High, no value needed",
			thinkingEffectReset: "Back to that tier's default: clear the row",
			thinkingEffectProLevels: "Pro family supports Low and High tiers only (Medium applies to Flash)",
			thinkingTieredLabel: "Default",
			thinkingSamplesTitle: "Measured thinking tokens",
			thinkingSamplesIntro: "The model adapts how long it thinks to the difficulty of the question, within the budget.",
			thinkingSamplesCaption: "This table shows what Gemini 3.8 Flash actually spent (in tokens) under different budgets, on questions of different difficulty.",
			thinkingSamplesComparison: "Entering the maximum (65535) is identical to selecting High on the hard question, but raises thinking on the easy and medium ones by about 10–15%. The value alone decides the effect — the same number entered on any row sends the same request.",
			thinkingSamplesSources: "Note: the hard question is a combinatorial derivation (derive a tiling recurrence and compute term 40), the medium one a number-theory proof (prove n⁴+4 is always composite), and the easy one a two-digit multiplication.",
			thinkingSamplesZero: "Low genuinely produces no thinking on the medium question (0 in repeated runs) — this is not missing data; Medium and High both think normally on the same question.",
			thinkingSamplesLevel: "Setting",
			thinkingSamplesEasy: "Easy",
			thinkingSamplesMedium: "Medium",
			thinkingSamplesHard: "Hard",
			thinkingSamplesMaxRow: "entered 65535",
			thinkingClaudeGroup: "Claude",
			thinkingClaudeLabel: "Budget",
			thinkingClaudeNoLevels: "No thinking levels — a single budget value ({min}–{max}).",
			thinkingClaudeMaxTokens: "Must be below the reply limit, or it is not sent.",
			thinkingClaudeNoReport: "Upstream does not report thinking tokens, so there is no reference table.",
			thinkingInvalid: "Enter a whole number.",
			multimodalTitle: "Multimodal inline limit",
			multimodalLabel: "Per file",
			multimodalUnit: "MB",
			multimodalAuto: "default",
			multimodalClear: "Clear",
			multimodalHint: "A file over the limit is not inlined, but its file handle stays in the conversation and the model can still read it with its file tools.",
			multimodalInvalid: "Enter a whole number.",
			multimodalRange: "Enter a whole number between {min} and {max}.",
			multimodalSourceDefault: "Unset · default {default} MB",
			multimodalSourceStored: "Your saved setting is in force",
			multimodalSourceEnv: "The DSH_AGY_MULTIMODAL_MAX_INLINE_MB environment variable overrides the setting here.",
			modelsTitle: "Model visibility",
			modelsHelp: "Switching a model off removes it from the model picker. Blacklist semantics: only models you switch off are hidden, so models the server adds later stay visible.",
			modelsHiddenSuffix: "{count} hidden right now.",
			modelToggleAria: "Show {name} in the model picker",
			emptyModels: "No models available. Sign in to an account first.",
			importTitle: "Import credentials",
			importHelp: "Paste an agy auth.json, or a credential blob from dsh-agy login --blob. One per line for a batch import.",
			importPlaceholder: "{\"token\":{\"access_token\":\"...\",\"refresh_token\":\"...\"}} or dsh-agy-cred-v1.... (one per line)",
			importJson: "Import JSON",
			importBlob: "Import blob",
			exportAll: "Export all"
		};
		//#endregion
		//#region src/client/element.ts
		/**
		* The element shorthand the browser half is written in.
		*
		* `h(tag, props, ...children)` keeps an element tree flat and readable where
		* nested `createElement` calls become a parenthesis maze — and this bundle has
		* no JSX transform, so there is no third option.
		*
		* A shared module rather than a copy per file: the Settings section and the
		* conversation-header badge build their trees the same way.
		*/
		function h(tag, props, ...children) {
			return (0, react.createElement)(tag, props ?? null, ...children);
		}
		//#endregion
		//#region src/types.ts
		/**
		* The upstream `window` tokens we understand: their ORDER by duration, and which
		* of them `CachedQuota` has a field for.
		*
		* ONE table for a vocabulary that used to live in two places giving two different
		* answers: `adapter/quota-summary.ts` sorted by its own token table while
		* `runtime/quota.ts` classified windows with `includes()` checks. The
		* disagreement was not academic — `daily` existed in one and not the other, so a
		* daily group parsed and display-sorted correctly, then contributed an EMPTY
		* record that replaced a real measurement.
		*
		* Keeping both facts in one row is deliberate: a token cannot be rankable in one
		* consumer and unknown to the other, because there is only one place to add it.
		* A missing `kind` means the cache has nowhere to put that reading, which is what
		* stops the empty-record overwrite.
		*
		* Declared in this leaf rather than in either consumer because BOTH need it:
		* `runtime/` must not reach into `adapter/`, and the persisted `QuotaWindow` is
		* already defined here.
		*
		* `rank` is explicit rather than inferred from token length so it states the
		* intended duration ordering: `daily` (5 chars) would otherwise sort before
		* `weekly` (6) for the wrong reason.
		*/
		const QUOTA_WINDOWS = {
			"5h": {
				rank: 0,
				kind: "rolling"
			},
			daily: { rank: 1 },
			weekly: {
				rank: 2,
				kind: "weekly"
			},
			monthly: { rank: 3 }
		};
		//#endregion
		//#region src/runtime/rotation.ts
		/** Below this remaining fraction the account is treated as soft-quota-exhausted. */
		const SOFT_QUOTA_THRESHOLD = .15;
		/**
		* The WEEKLY window's exhaustion threshold, and deliberately NOT
		* `SOFT_QUOTA_THRESHOLD`.
		*
		* The two numbers answer the same question — "how much work is left in this
		* window?" — about windows of very different lengths, so they only look
		* inconsistent when read side by side:
		*
		*   15% of a 5-hour window is ~45 minutes of runway.
		*   1%  of a 7-day window  is ~1.7 hours of runway.
		*
		* The weekly bar is the stricter one where it matters, because being wrong is
		* asymmetric: a drained 5-hour window refills within five hours, while a drained
		* weekly window parks the account for DAYS. Treating an account as drained a
		* little early costs one rotation; treating it as usable too late costs the user
		* a failed request with no healthy fallback.
		*
		* Do not "unify" these two constants without re-deriving both runways above.
		*/
		const WEEKLY_QUOTA_THRESHOLD = .01;
		/** Absolute server-reported reset in ms when it lies in the future, else undefined. */
		function parseFutureResetMs(resetTime, now = Date.now()) {
			if (!resetTime) return void 0;
			const reset = Date.parse(resetTime);
			if (Number.isNaN(reset) || reset <= now) return void 0;
			return reset;
		}
		//#endregion
		//#region src/client/quota-view.ts
		/**
		* Pure quota view layer, shared by the conversation-header badge
		* (`quota-badge.ts`) and the Settings section's own limits card.
		*
		* No React, no fetch, no DOM: every figure and every word is computed here from
		* data handed in, with `now` always injected, so `tests/quota-view.test.ts` can
		* pin the badge's arithmetic without a browser.
		*
		* Nothing in this module restates an upstream fact:
		*
		* - the window vocabulary and its order come from `QUOTA_WINDOWS`
		*   (`../types.ts`), the one table the adapter and the scheduler also read;
		* - the drain thresholds are IMPORTED from `../runtime/rotation.ts`, so the
		*   badge ranks windows by the same numbers the pool rotates on;
		* - "the reset has passed" is `parseFutureResetMs`, the predicate the pool
		*   itself applies (`isFamilyDrained`, `rankPoolCandidates`);
		* - every visible word comes from the `agy` dictionary (`locales.ts`).
		*
		* A window with no reported fraction is "unknown" and renders as an em dash —
		* never as 0%, because unknown headroom and no headroom are opposite facts.
		*/
		const MINUTE_MS = 6e4;
		const HOUR_MS = 60 * MINUTE_MS;
		const DAY_MS = 24 * HOUR_MS;
		/**
		* Localized label for an upstream quota window token.
		*
		* The tokens are mapped rather than printed so the surface follows the UI
		* language, and an UNRECOGNIZED token falls back to its raw value: upstream may
		* add a window, and showing `30d` is better than a blank or a wrong label.
		*/
		function windowLabel(window, t) {
			switch (window) {
				case "5h": return t("quotaWindow5h");
				case "daily": return t("quotaWindowDaily");
				case "weekly": return t("quotaWindowWeekly");
				case "monthly": return t("quotaWindowMonthly");
				default: return window;
			}
		}
		/** Localized account-state label. */
		function stateLabel(state, t) {
			switch (state) {
				case "active": return t("stateActive");
				case "cooling": return t("stateCooling");
				case "verification-required": return t("stateVerificationRequired");
				case "disabled": return t("stateDisabled");
			}
		}
		/**
		* Time until a future moment, as localized copy.
		*
		* A quota reset wall is often more than 24h out, so a bare `HH:mm` cannot say
		* whether it means today or tomorrow. Bucket boundaries mirror the host's
		* `relativeTime`; the words stay in this plugin's own dictionary, which is
		* exactly the split that API intends.
		*/
		function untilText(iso, t, now) {
			if (iso === null) return "—";
			const at = new Date(iso).getTime();
			if (Number.isNaN(at)) return "—";
			const diff = at - now;
			if (diff <= 0) return t("relNow");
			return t("quotaResetIn", { value: diff < 6e4 ? t("relNow") : diff < 36e5 ? t("relMinutes", { n: Math.floor(diff / MINUTE_MS) }) : diff < 864e5 ? t("relHours", { n: Math.floor(diff / HOUR_MS) }) : diff < 2592e6 ? t("relDays", { n: Math.floor(diff / DAY_MS) }) : diff < 31536e6 ? t("relMonths", { n: Math.floor(diff / (30 * DAY_MS)) }) : t("relYears", { n: Math.floor(diff / (365 * DAY_MS)) }) });
		}
		/**
		* How long ago a past moment was (the mirror of `untilText`).
		*
		* Reuses the same `rel*` magnitudes so the two read consistently, but adds a
		* direction suffix: a bare magnitude beside a cooldown could equally mean when
		* it started or when it ends.
		*/
		function agoText(iso, t, now) {
			if (iso === null) return "—";
			const at = new Date(iso).getTime();
			if (Number.isNaN(at)) return "—";
			const diff = now - at;
			if (diff < 6e4) return t("relJustNow");
			return t("relAgo", { value: diff < 36e5 ? t("relMinutes", { n: Math.floor(diff / MINUTE_MS) }) : diff < 864e5 ? t("relHours", { n: Math.floor(diff / HOUR_MS) }) : diff < 2592e6 ? t("relDays", { n: Math.floor(diff / DAY_MS) }) : diff < 31536e6 ? t("relMonths", { n: Math.floor(diff / (30 * DAY_MS)) }) : t("relYears", { n: Math.floor(diff / (365 * DAY_MS)) }) });
		}
		/**
		* The reset moment of one window.
		*
		* A wall that has already passed is its own state rather than a zero-distance
		* countdown: `untilText` answers "shortly" for `diff <= 0`, which is precisely
		* the promise the old badge made about a window that had already refilled.
		*/
		function resetText(resetTime, t, now) {
			if (resetTime === null) return null;
			const at = Date.parse(resetTime);
			if (Number.isNaN(at)) return null;
			if (at <= now) return t("quotaResetPassed");
			return untilText(resetTime, t, now);
		}
		/**
		* Detailed reset countdown for a quota window:
		* - 5h window: e.g. "resets in 3h 15m" / "resets in 45m"
		* - daily/weekly window: full date + countdown: "MM/DD HH:mm (5d 12h later)" / "(5d later)" / "(45m later)"
		*/
		function formatDetailedReset(window, resetTime, t, now = Date.now()) {
			if (!resetTime) return null;
			const at = Date.parse(resetTime);
			if (Number.isNaN(at)) return null;
			if (at <= now) return t("quotaResetPassed");
			const resetDate = new Date(at);
			const diffMs = at - now;
			const diffMins = Math.floor(diffMs / MINUTE_MS);
			const diffHours = Math.floor(diffMins / 60);
			const diffDays = Math.floor(diffHours / 24);
			if (window === "5h") {
				if (diffHours > 0) return t("badgeReset5hHoursMins", {
					hours: diffHours,
					mins: diffMins % 60
				});
				return t("badgeReset5hMins", { mins: Math.max(1, diffMins) });
			}
			let countdown = "";
			if (diffDays > 0) {
				const hours = diffHours % 24;
				countdown = hours > 0 ? t("badgeCountdownDaysHours", {
					days: diffDays,
					hours
				}) : t("badgeCountdownDays", { days: diffDays });
			} else if (diffHours > 0) countdown = t("badgeCountdownHours", { hours: diffHours });
			else countdown = t("badgeCountdownMins", { mins: Math.max(1, diffMins) });
			return t("badgeResetFullDate", {
				month: resetDate.getMonth() + 1,
				day: resetDate.getDate(),
				time: `${resetDate.getHours().toString().padStart(2, "0")}:${resetDate.getMinutes().toString().padStart(2, "0")}`,
				countdown
			});
		}
		/**
		* Format a window's reset moment with optional detailed countdown precision.
		*/
		function formatQuotaReset(window, resetTime, t, now = Date.now(), detailed = false) {
			if (!resetTime) return null;
			if (detailed) return formatDetailedReset(window, resetTime, t, now);
			return resetText(resetTime, t, now);
		}
		/** Sort rank for a window token; an unknown token ranks last. */
		function windowRank(window) {
			return QUOTA_WINDOWS[window]?.rank ?? Number.MAX_SAFE_INTEGER;
		}
		/** Order windows shortest-first; an unknown token last, tie-broken alphabetically. */
		function sortWindows(windows) {
			return [...windows].sort((a, b) => windowRank(a.window) - windowRank(b.window) || a.window.localeCompare(b.window));
		}
		/** 0..100 for a usable fraction, or null when it is absent or not finite. */
		function toPercent(fraction) {
			if (typeof fraction !== "number" || !Number.isFinite(fraction)) return null;
			return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
		}
		/**
		* Quota tint by remaining fraction: healthy / low / critical.
		*
		* The thresholds are the Settings section's own, so the badge's bars read the
		* same colour as the limits card's beside them. Built from `--dsw-alias-*`
		* tokens (with the literal as a pre-theme fallback) rather than fixed hex: a
		* private palette does not follow the host's light/dark switch.
		*/
		function quotaColor(fraction) {
			if (fraction > .7) return aliasVar("state-success-primary");
			if (fraction >= .3) return aliasVar("state-warn-primary");
			return aliasVar("state-error-primary");
		}
		/**
		* The drain threshold that governs one window token, or undefined when the pool
		* does not block on that window.
		*
		* The two numbers are IMPORTED from `runtime/rotation.ts` because they answer
		* the same question there ("how much work is left" over windows of different
		* lengths), which is why they are deliberately asymmetric. `daily`/`monthly`
		* report but never block, so they have no threshold and never drive the badge.
		*/
		function drainThresholdFor(window) {
			if (window === "5h") return SOFT_QUOTA_THRESHOLD;
			if (window === "weekly") return WEEKLY_QUOTA_THRESHOLD;
		}
		/** The windows the pool actually blocks on. */
		function rotationWindows(group) {
			return group.windows.filter((window) => drainThresholdFor(window.window) !== void 0);
		}
		/**
		* Whether a window's reset moment has already passed.
		*
		* The pool treats such a window as unmeasured (`isFamilyDrained`,
		* `rankPoolCandidates`): the cached fraction describes a period that has ENDED,
		* so it is not evidence about the one we are in. This view layer reads the same
		* records, so it has to apply the same rule — otherwise a spent five-hour window
		* that has already rolled over keeps the badge red long after the pool resumed
		* serving that account.
		*
		* A reset moment that cannot be parsed counts as passed: it cannot be shown to
		* be in the future, and the reading it dates is not trustworthy either way.
		* A window that reported no reset moment at all is NOT stale — the pool keeps
		* using its fraction, and so does this.
		*/
		function resetInPast(resetTime, now) {
			if (resetTime === null) return false;
			return parseFutureResetMs(resetTime, now) === void 0;
		}
		/**
		* Whether a window's fraction is a leftover from a period that has ended.
		*
		* Only a window that DID report a fraction can be stale: one that never reported
		* stays "unknown", which the row already renders as its own case.
		*/
		function windowIsStale(window, now) {
			return window.remainingFraction !== null && resetInPast(window.resetTime, now);
		}
		/**
		* How close a window is to its own drain point, as a threshold multiple.
		*
		* Comparing raw `remainingFraction` values would rank a comfortable 44% week
		* above a comfortable 82% five-hour window and hand the badge to the week, which
		* is not what stops a request. Dividing by each window's own drain threshold asks
		* the question the pool itself asks — how much runway is left before this window
		* stops serving — so the five-hour window stays in charge until the week is
		* genuinely nearly spent.
		*/
		function windowPressure(window, now) {
			if (window.remainingFraction === null) return null;
			if (resetInPast(window.resetTime, now)) return null;
			const threshold = drainThresholdFor(window.window);
			if (threshold === void 0 || threshold <= 0) return null;
			return Math.max(window.remainingFraction, 0) / threshold;
		}
		/**
		* Pick the window that constrains the account first, for the header badge.
		*
		* Groups are read in upstream's own order — it lists the Gemini budget first —
		* and the FIRST group reporting a blocking window decides on its own: mixing
		* groups would blend one budget with another. Within that group the window with
		* the smallest threshold multiple wins.
		*
		* Deliberately no family inference here (the badge used to match group names
		* against `/gemini/`): upstream's grouping is a payload detail, and the pool's
		* own family mapping lives in `runtime/quota.ts`, which the browser bundle does
		* not carry.
		*/
		function pickBadgeWindow(limits, now) {
			if (!limits || limits.length === 0) return null;
			for (const group of limits) {
				const candidates = rotationWindows(group);
				if (candidates.length === 0) continue;
				let best = null;
				let bestPressure = Number.POSITIVE_INFINITY;
				for (const window of candidates) {
					const pressure = windowPressure(window, now);
					if (pressure === null) continue;
					if (pressure < bestPressure) {
						best = window;
						bestPressure = pressure;
					}
				}
				if (best !== null) return best;
				return null;
			}
			for (const group of limits) {
				const first = sortWindows(group.windows).filter((window) => !windowIsStale(window, now))[0];
				if (first !== void 0) return first;
			}
			return null;
		}
		/**
		* The badge's reading: the most constrained tracked window of the ACTIVE account.
		*
		* Reported `daily`/`monthly` windows never drive the badge: the pool does not
		* block on them, so a low monthly figure is not a reason to alarm the header.
		* Returns null when nothing usable is known — the caller renders a dash instead
		* of inventing 0%.
		*/
		function pickBadgeQuota(accounts, now = Date.now()) {
			const window = pickBadgeWindow((accounts.find((account) => account.active) ?? accounts[0])?.limits, now);
			if (window === null) return null;
			const percent = toPercent(window.remainingFraction);
			if (percent === null) return null;
			return {
				percent,
				window: window.window
			};
		}
		/** Build the window rows of one group card. */
		function windowRows(windows, t, now, detailed = false) {
			return sortWindows(windows).map((window) => {
				const stale = windowIsStale(window, now);
				return {
					bucketId: window.bucketId,
					label: windowLabel(window.window, t),
					percent: stale ? null : toPercent(window.remainingFraction),
					reset: formatQuotaReset(window.window, window.resetTime, t, now, detailed),
					stale
				};
			});
		}
		/**
		* Build the quota cards for one account.
		*
		* One card per upstream group, exactly as the group arrived: the grouped
		* windows are the only quota channel this plugin has now, and upstream's own
		* split ("Gemini Models" / "Claude and GPT models") cannot be re-derived from
		* model-id prefixes — `3p-*` covers Claude AND GPT.
		*
		* A group whose windows all turned out to be unusable would render as an empty
		* card that pushes a real one off screen, so those are dropped.
		*/
		function buildQuotaCards(account, t, now, detailed = false) {
			const groups = account?.limits;
			if (!groups || groups.length === 0) return [];
			const cards = [];
			for (const group of groups) {
				const rows = windowRows(group.windows, t, now, detailed);
				if (rows.length === 0) continue;
				cards.push({
					key: group.name || `group-${cards.length}`,
					title: group.name || t("quotaGroupFallback"),
					windows: rows
				});
			}
			return cards;
		}
		/**
		* Which StateDot semantic the badge's health light shows.
		*
		* The pool is usable when some account is serving; anything else (a cooling
		* account, one parked behind verification, a disabled one) is user attention
		* rather than a hard failure, and an empty pool is idle rather than broken.
		*/
		function dotStateFor(accounts) {
			if (accounts.length === 0) return "idle";
			if (!accounts.some((account) => account.active || account.state === "active")) return "warning";
			return accounts.some((account) => account.state !== "active") ? "warning" : "done";
		}
		/**
		* Mask an account email for the header surface.
		*
		* Deliberately NOT what the Settings section does: that panel shows the address
		* in full, on a page the user opened on purpose. The conversation header sits on
		* screen for the whole session — including during a share or a recording — so the
		* local part is shortened and the domain kept, which is enough to tell two
		* accounts apart without publishing the address.
		*/
		function desensitizeEmail(email) {
			if (!email || !email.includes("@")) return email || "—";
			const [name, domain] = email.split("@");
			if (name === void 0 || domain === void 0) return email;
			if (name.length <= 3) return `${name.slice(0, 1)}***@${domain}`;
			if (name.length <= 6) return `${name.slice(0, 2)}***@${domain}`;
			return `${name.slice(0, 5)}***@${domain}`;
		}
		/**
		* Which probe a refresh should run.
		*
		* `force` re-probes inside the host's window (the user asked); `off` leaves the
		* window refresh out entirely for this tick; `auto` lets the host's TTL decide.
		* Ported from the standalone badge, which learned that a failed probe run has to
		* back itself off.
		*/
		function shouldProbeLimits(input) {
			if (input.force) return "force";
			if (input.failedAt !== null && input.now - input.failedAt < 6e5) return "off";
			return "auto";
		}
		//#endregion
		//#region src/client/quota-badge.ts
		/**
		* Conversation-header quota badge & popover.
		*
		* Shows the tightest of the active account's tracked windows, and opens the
		* window breakdown floating card on hover or click.
		*
		* Built with DSH native UI primitives (Button, Tag, StateDot, useAnchoredPosition,
		* useDismissOnOutsidePointer) and semantic design tokens (--dsw-*).
		*/
		/**
		* Render-tick cadence for the countdown and staleness figures. Pure state
		* recompute from already-fetched data — deliberately ZERO RPC: the fetch paths
		* are mount, window wake (throttled above) and the popover's refresh button,
		* and without this tick the countdown text would freeze between fetches.
		*/
		const RENDER_TICK_MS = 6e4;
		/**
		* Grace period before hover close (250ms).
		*/
		const HOVER_CLOSE_DELAY_MS = 250;
		/**
		* Quota bar and percentage color for a window.
		* Strictly unified with upstream Settings panel via quotaColor(percent / 100).
		* Thresholds: >70% success green, 30%-70% warning amber, <30% error red.
		*/
		function quotaColorForWindow(percent) {
			if (percent === null) return aliasVar("label-tertiary");
			return quotaColor(percent / 100);
		}
		/** Render one window row of a quota card. */
		function renderWindow(window, index, t) {
			return h("div", {
				key: window.bucketId,
				className: "agy-ui-limit-row"
			}, h("div", { className: "agy-ui-limit-header" }, h("span", { className: "agy-ui-limit-title" }, window.label), h("span", {
				className: "agy-ui-limit-percent",
				style: { color: window.color }
			}, window.percent === null ? "—" : `${window.percent}%`)), h("div", { className: "agy-ui-progress-track" }, h("div", {
				className: "agy-ui-progress-fill",
				style: {
					width: `${window.percent ?? 0}%`,
					backgroundColor: window.color
				}
			})), window.reset ? h("div", { className: "agy-ui-quota-footer" }, h("span", null, window.reset)) : null, window.percent === null ? h("div", { className: "agy-ui-window-note" }, window.stale ? t("quotaStaleNote") : t("quotaUnmeasuredNote")) : null);
		}
		/**
		* The badge and its popover modal.
		*/
		function AgyQuotaBadge({ rpc, t }) {
			const [accounts, setAccounts] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(false);
			const [isUpdating, setIsUpdating] = (0, react.useState)(false);
			const [isHovered, setIsHovered] = (0, react.useState)(false);
			const [isPinned, setIsPinned] = (0, react.useState)(false);
			const [isMobile, setIsMobile] = (0, react.useState)(false);
			const [now, setNow] = (0, react.useState)(() => Date.now());
			const [detailedReset, setDetailedReset] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const leaveTimerRef = (0, react.useRef)(null);
			const lastFetchTimeRef = (0, react.useRef)(0);
			const failedAtRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				installAgyStyles();
				const checkMobile = () => {
					setIsMobile(typeof window !== "undefined" && window.innerWidth <= 640);
				};
				checkMobile();
				window.addEventListener("resize", checkMobile);
				const onPrefsChange = (e) => {
					const detail = e.detail;
					if (detail && typeof detail.detailedQuotaReset === "boolean") setDetailedReset(detail.detailedQuotaReset);
				};
				window.addEventListener("agy:ui-prefs-changed", onPrefsChange);
				return () => {
					window.removeEventListener("resize", checkMobile);
					window.removeEventListener("agy:ui-prefs-changed", onPrefsChange);
				};
			}, []);
			const load = (0, react.useCallback)(async (isManual = false) => {
				const currentNow = Date.now();
				if (!isManual && lastFetchTimeRef.current > 0 && currentNow - lastFetchTimeRef.current < 119e3) return;
				lastFetchTimeRef.current = currentNow;
				setIsUpdating(true);
				setLoading(true);
				try {
					const [listed, prefs] = await Promise.all([rpc.call("account.list", {}), rpc.call("ui.prefs.get", {}).catch(() => null)]);
					setAccounts(listed.accounts);
					if (prefs) setDetailedReset(prefs.detailedQuotaReset === true);
					setError(null);
					const probe = shouldProbeLimits({
						force: isManual,
						failedAt: failedAtRef.current,
						now: Date.now()
					});
					if (probe !== "off") {
						const limits = await rpc.call("account.limits", probe === "force" ? { force: true } : {});
						const byIndex = new Map(limits.limits.map((entry) => [entry.index, entry]));
						setAccounts((current) => current.map((account) => {
							const entry = byIndex.get(account.index);
							return entry === void 0 ? account : {
								...account,
								limits: entry.groups,
								limitsUpdatedAt: entry.updatedAt
							};
						}));
						failedAtRef.current = limits.measured === 0 && limits.failed > 0 ? Date.now() : null;
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
					setNow(Date.now());
					setTimeout(() => {
						setIsUpdating(false);
					}, 1200);
				}
			}, [rpc]);
			(0, react.useEffect)(() => {
				load(false);
				const tick = window.setInterval(() => setNow(Date.now()), RENDER_TICK_MS);
				const onWake = () => {
					if (document.visibilityState !== "hidden") load(false);
				};
				window.addEventListener("focus", onWake);
				document.addEventListener("visibilitychange", onWake);
				return () => {
					window.clearInterval(tick);
					window.removeEventListener("focus", onWake);
					document.removeEventListener("visibilitychange", onWake);
					if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
				};
			}, [load]);
			const isOpen = isPinned || isHovered;
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, isPinned, setIsPinned, panelRef);
			const anchored = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open: isOpen && !isMobile,
				anchorRef: rootRef,
				panelRef,
				side: "bottom",
				gap: 6,
				margin: 12
			});
			const handleMouseEnterBadge = () => {
				if (leaveTimerRef.current !== null) {
					window.clearTimeout(leaveTimerRef.current);
					leaveTimerRef.current = null;
				}
				setIsHovered(true);
			};
			const handleMouseLeaveBadge = () => {
				if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
				leaveTimerRef.current = window.setTimeout(() => {
					setIsHovered(false);
				}, HOVER_CLOSE_DELAY_MS);
			};
			const handleMouseEnterPopover = () => {
				if (leaveTimerRef.current !== null) {
					window.clearTimeout(leaveTimerRef.current);
					leaveTimerRef.current = null;
				}
			};
			const handleMouseLeavePopover = () => {
				if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
				leaveTimerRef.current = window.setTimeout(() => {
					setIsHovered(false);
				}, HOVER_CLOSE_DELAY_MS);
			};
			const handleTogglePin = (e) => {
				e?.stopPropagation();
				setIsPinned((prev) => !prev);
				setIsHovered(true);
			};
			const handleClose = () => {
				if (leaveTimerRef.current !== null) {
					window.clearTimeout(leaveTimerRef.current);
					leaveTimerRef.current = null;
				}
				setIsPinned(false);
				setIsHovered(false);
			};
			const handleRefreshClick = async (e) => {
				e.stopPropagation();
				if (loading) return;
				await load(true);
			};
			const activeAccount = accounts.find((a) => a.active) ?? accounts[0];
			const accountCount = accounts.length;
			const rawDot = dotStateFor(accounts);
			const dotState = rawDot === "done" ? "active" : rawDot === "warning" ? "cooling" : "disabled";
			const badgeQuota = pickBadgeQuota(accounts, now);
			const badgeWindow = badgeQuota?.window && badgeQuota.window !== "5h" ? `${windowLabel(badgeQuota.window, t)} ` : "";
			const displayText = badgeQuota !== null ? badgeWindow !== "" ? t("badgeWindowQuotaFormat", {
				window: badgeWindow,
				percent: badgeQuota.percent
			}) : t("badgeQuotaFormat", { percent: badgeQuota.percent }) : t("badgeCountFormat", { count: accountCount });
			const cards = buildQuotaCards(activeAccount, t, now, detailedReset).map((rc) => ({
				key: rc.key,
				title: rc.title,
				windows: rc.windows.map((w) => ({
					bucketId: w.bucketId,
					label: w.label,
					percent: w.percent,
					color: quotaColorForWindow(w.percent),
					reset: w.reset,
					stale: w.stale
				}))
			}));
			const limitsAge = activeAccount?.limitsUpdatedAt ? agoText(new Date(activeAccount.limitsUpdatedAt).toISOString(), t, now) : null;
			const badgeTooltip = t("badgeTooltip", {
				count: accountCount,
				reading: badgeQuota !== null ? t("badgeReading", {
					window: badgeWindow,
					percent: badgeQuota.percent
				}) : t("badgeUnmeasured")
			});
			const popoverContent = h("div", {
				ref: panelRef,
				className: `agy-ui-popover ${isMobile ? "mobile" : "desktop"}`,
				style: !isMobile ? anchored === null ? { visibility: "hidden" } : {
					position: "fixed",
					top: `${anchored.top}px`,
					left: `${anchored.left}px`,
					visibility: "visible"
				} : void 0,
				onMouseEnter: handleMouseEnterPopover,
				onMouseLeave: handleMouseLeavePopover,
				onClick: (e) => {
					e.stopPropagation();
				}
			}, isMobile ? h("div", { className: "agy-ui-mobile-handle" }) : null, h("div", { className: "agy-ui-modal-header" }, h("div", { className: "agy-ui-modal-title" }, h("span", { className: "agy-ui-sparkle" }, "✦"), h("span", null, t("badgeTitle")), isPinned && !isMobile ? h(_deepseek_ai_dsh_client_ui_primitives.Tag, {
				tone: "solid",
				className: "agy-ui-pinned-tag"
			}, t("badgePinned")) : null), h("div", { className: "agy-ui-header-actions" }, !isMobile ? h(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "ghost",
				size: "sm",
				className: `agy-ui-icon-btn ${isPinned ? "active" : ""}`,
				title: isPinned ? t("badgeUnpinHint") : t("badgeHint"),
				onClick: handleTogglePin
			}, h("svg", {
				width: "13",
				height: "13",
				viewBox: "0 0 24 24",
				fill: isPinned ? "currentColor" : "none",
				stroke: "currentColor",
				strokeWidth: "2"
			}, h("path", { d: "M12 2v8m0 0l3-3m-3 3L9 7M5 10h14a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2zM12 15v7" }))) : null, h(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "ghost",
				size: "sm",
				className: "agy-ui-icon-btn",
				title: t("badgeRefreshHint"),
				onClick: handleRefreshClick,
				disabled: loading
			}, h("svg", {
				className: loading || isUpdating ? "agy-ui-spinning" : "",
				width: "13",
				height: "13",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}, h("path", { d: "M21.5 2v6h-6M2.5 22v-6h6M2.5 11.5a10 10 0 0 1 17.5-4.5l1.5 2M21.5 12.5a10 10 0 0 1-17.5 4.5l-1.5-2" }))), h(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "ghost",
				size: "sm",
				className: "agy-ui-icon-btn",
				title: t("badgeClose"),
				onClick: handleClose
			}, h("svg", {
				width: "13",
				height: "13",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}, h("line", {
				x1: "18",
				y1: "6",
				x2: "6",
				y2: "18"
			}), h("line", {
				x1: "6",
				y1: "6",
				x2: "18",
				y2: "18"
			}))))), h("div", { className: "agy-ui-modal-body" }, activeAccount ? h("div", { className: "agy-ui-account-card" }, h("div", null, h("div", { className: "agy-ui-account-email" }, desensitizeEmail(activeAccount.email)), h("div", { className: "agy-ui-account-project" }, `${t("fieldProject")}: ${activeAccount.projectId || t("thinkingDefaultAll")}`)), h(_deepseek_ai_dsh_client_ui_primitives.Tag, {
				tone: activeAccount.state === "active" ? "success" : activeAccount.state === "cooling" ? "warning" : "danger",
				className: `agy-ui-state-pill ${activeAccount.state || "active"}`
			}, stateLabel(activeAccount.state || "active", t))) : h("div", { className: "agy-ui-account-card" }, h("div", {
				className: "agy-ui-account-email",
				style: { color: aliasVar("label-tertiary") }
			}, error ?? t("badgeNoAccount"))), activeAccount?.verificationRequired && activeAccount?.verificationUrl ? h("div", { className: "agy-ui-verify-note" }, h("span", null, t("badgeVerifyRequired")), h("a", {
				className: "agy-ui-link-btn",
				href: activeAccount.verificationUrl,
				target: "_blank",
				rel: "noopener noreferrer"
			}, t("badgeAppealLink"))) : null, h("div", { className: "agy-ui-section-label" }, t("badgeSectionMonitor")), ...cards.map((card) => h("div", {
				key: card.key,
				className: "agy-ui-quota-card"
			}, h("div", { className: "agy-ui-quota-header" }, h("span", { className: "agy-ui-model-name" }, card.title)), ...card.windows.map((w, idx) => renderWindow(w, idx, t)))), cards.length === 0 ? h("div", { className: "agy-ui-window-note" }, t("badgeNoQuotaData")) : null, limitsAge ? h("div", { className: "agy-ui-limit-age" }, t("badgeMeasuredAt", { time: limitsAge })) : null), h("div", { className: "agy-ui-modal-footer" }, h("span", null, t("quotaSourceCaption")), h("span", null, t("quotaManageHint"))));
			const popoverNode = isOpen ? isMobile ? h("div", {
				className: "agy-ui-popover-container mobile",
				onClick: handleClose
			}, popoverContent) : popoverContent : null;
			return h("span", {
				ref: rootRef,
				style: {
					position: "relative",
					display: "inline-flex",
					alignItems: "center"
				}
			}, h(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "ghost",
				size: "sm",
				className: `agy-ui-badge ${isPinned ? "pinned" : ""}`,
				title: badgeTooltip,
				"aria-label": t("badgeAria"),
				onClick: handleTogglePin,
				onMouseEnter: handleMouseEnterBadge,
				onMouseLeave: handleMouseLeaveBadge
			}, h(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
				state: rawDot,
				size: 7,
				className: `agy-ui-dot ${dotState}${isUpdating ? " updating" : ""}`
			}), h("span", null, displayText)), popoverNode);
		}
		//#endregion
		//#region src/thinking-types.ts
		/**
		* Thinking-budget vocabulary shared by the host store, the RPC wire contract,
		* and the browser UI.
		*
		* Split out for the same reason `usage-types.ts` exists: these types live on
		* their own, free of any `node:*` import, so the browser bundle can describe the
		* settings surface without pulling in the host's storage module. Putting them in
		* `thinking-budget.ts` instead made `rpc-contract.ts` (which the client
		* typechecks) reach `node:fs` through the transitive import — caught by
		* `tsconfig.client.json`, which includes the contract and excludes `src/store`.
		*/
		/** The three levels a tiered model exposes, in display order. */
		const THINKING_LEVELS = [
			"low",
			"medium",
			"high"
		];
		/**
		* The Claude family's `thinkingBudget` bounds, measured separately from Gemini's.
		*
		* The two families do NOT share a contract, which is why one interval cannot
		* serve both:
		*   - Claude's floor is **1024**, not `-1`. A budget of 1 or 512 is rejected with
		*     `thinking.enabled.budget_tokens: Input should be greater than or equal to
		*     1024`; `-1` and `0` are accepted as special values.
		*   - Claude additionally requires **`max_tokens` strictly greater than the
		*     budget**: `budget=1024, max_tokens=1024` is a 400, and a budget sent with
		*     no `maxOutputTokens` at all also fails. So the margin is at least one token.
		*
		* `CLAUDE_BUDGET_MAX` is therefore one below `AGY_CLAUDE_MAX_OUTPUT_TOKENS` — the
		* largest budget that can still leave room for a strictly greater `max_tokens`.
		*/
		const CLAUDE_BUDGET_MIN = 1024;
		const CLAUDE_BUDGET_MAX = 63999;
		//#endregion
		//#region src/client/index.ts
		/**
		* agy Settings section — the browser half.
		*
		* One `settings.section` page with five tabs (accounts, models, config, usage,
		* credentials), replacing the standalone `/agy` dashboard. Every figure comes
		* from the `/api/agy` RPC over `ctx.connection`, so this section needs no
		* host-rendered page and there is no second UI to keep in step.
		*
		* Elements are built through the local `h` helper rather than JSX or nested
		* `createElement` calls: this package configures no JSX transform for the client
		* bundle, and `h(tag, props, ...children)` keeps the element tree flat and
		* readable where nested `createElement` calls become a parenthesis maze.
		*/
		/** Required browser services: the slot registry, dictionaries, and the RPC carrier. */
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		/** Dictionary namespace this plugin owns. */
		const NS = "agy";
		/** RPC channel and endpoint the host registers as `/api/agy`. */
		const RPC_CHANNEL = "/api";
		const RPC_ENDPOINT = "agy";
		/**
		* How long a one-shot action's verdict stays on screen.
		*
		* Both the success and the failure channel use this: an action's outcome is a
		* transient acknowledgement, and the screen is in a valid state either way. A
		* STANDING failure (the account list failing to load) deliberately does not use
		* it — see `actionError` in `AgySettings`.
		*/
		const ACTION_MESSAGE_TTL_MS = 3500;
		/**
		* How often the section re-reads the pool's in-flight snapshot.
		*
		* The call is a pure in-memory read on the host (no token refresh, no quota
		* probe), so a tight-ish interval is free; 3s makes the live line feel live
		* without a visible request cost.
		*/
		const POOL_POLL_INTERVAL_MS = 3e3;
		/** Call one management method and unwrap the Connection RPC envelope. */
		function createRpc(connection) {
			return { async call(method, payload, signal) {
				const raw = await connection.rpc.call(RPC_CHANNEL, RPC_ENDPOINT, {
					method,
					payload
				}, signal);
				if (raw?.ok === true) return raw.value;
				if (raw?.ok === false) throw new Error(raw.error?.message ?? `${method} failed`);
				throw new Error(`${method}: malformed RPC response`);
			} };
		}
		/** Compact token text: 1.2M / 284K / 512. */
		/** Token-count units, largest first. */
		const TOKEN_UNITS = [
			[0xe8d4a51000, "T"],
			[1e9, "B"],
			[1e6, "M"],
			[1e3, "K"]
		];
		/**
		* Compact token count: `1.2M` / `284K` / `512`. Counts below 1000 render in
		* full — a suffix starts at 1K.
		*
		* The unit is chosen from the value ROUNDED TO ITS DISPLAYED PRECISION, and
		* promoted when that rounding would reach 1000 (which belongs to the next unit).
		* Deciding from the raw magnitude let rounding contradict the suffix: 999_999
		* printed as `1000K`, 99999 as `100.0K` while 100000 was `100K`, and 9999999 as
		* `10.0M` while 10000000 was `10M`.
		*
		* Exported for a direct unit test: the boundaries are exactly where this broke.
		* @param value - token count.
		* @returns the display string.
		*/
		function tokenText(value) {
			if (value < 1e3) return String(value);
			/** One decimal below 100 (`1.2M`), none at or above (`284K`). */
			const render = (scaled, suffix) => `${scaled < 100 ? scaled.toFixed(1) : String(Math.round(scaled))}${suffix}`;
			const start = TOKEN_UNITS.findIndex(([divisor]) => value >= divisor);
			for (let index = start; index >= 0; index--) {
				const [divisor, suffix] = TOKEN_UNITS[index];
				const scaled = Math.round(value / divisor * 10) / 10;
				if (scaled < 1e3) return render(scaled, suffix);
			}
			const [divisor, suffix] = TOKEN_UNITS[0];
			return render(Math.round(value / divisor * 10) / 10, suffix);
		}
		function formatDuration(ms) {
			if (!Number.isFinite(ms) || ms <= 0) return "—";
			if (ms < 1e3) return `${Math.round(ms)}ms`;
			const seconds = ms / 1e3;
			if (seconds < 60) return `${seconds.toFixed(1)}s`;
			const whole = Math.round(seconds);
			return `${Math.floor(whole / 60)}m${String(whole % 60).padStart(2, "0")}s`;
		}
		/** Cache-hit share of prompt-side input; null when nothing was billed. */
		function cacheHitPercent(counters) {
			const billed = counters.input + counters.cacheRead + counters.cacheWrite;
			if (billed <= 0) return null;
			return Math.round(counters.cacheRead / billed * 100);
		}
		function average(total, count) {
			return count > 0 ? total / count : 0;
		}
		/** Total tokens across the four disjoint buckets. */
		function totalTokens(counters) {
			return counters.input + counters.output + counters.cacheRead + counters.cacheWrite;
		}
		/**
		* Cumulative average OUTPUT rate for one scope, in tokens per second.
		*
		* Pure and exported for a direct unit test. The denominator is the STREAMING
		* window (average latency minus average time-to-first-token), NOT the wall
		* clock: on this channel the pre-first-token wait (upstream queue, routing,
		* prompt processing, silent thinking) is ~90% of the request — measured 7.5s
		* of an 8.3s average — so dividing by wall time understated the decode rate
		* about 8× (40 tok/s shown where the account really streamed ~300).
		*
		* Per-request AVERAGES, not raw sums: a failed request carries wall time but
		* never a first token (`latencyN` > `ttftN`), so subtracting raw sums would
		* hand its wait to the decode window. Both averages must exist — a scope with
		* no timed request or no reported first token gets null, hiding the row rather
		* than showing a fake rate.
		*/
		function throughputTokenPerSecond(totals) {
			if (totals.latencyN === 0 || totals.ttftN === 0 || totals.output <= 0) return null;
			const decodeMs = totals.latencyMs / totals.latencyN - totals.ttftMs / totals.ttftN;
			if (decodeMs <= 0) return null;
			return Math.round(totals.output / totals.latencyN / (decodeMs / 1e3));
		}
		/**
		* The whole prompt side: everything the model read, cached or not.
		*
		* The LEDGER keeps `input` as the uncached portion alone, because that is DSH's
		* own disjoint-bucket vocabulary (`usage-types.ts`, and the adapter's SSE parse
		* subtracts the cached count for exactly this reason) — that split must not be
		* redefined at the storage layer.
		*
		* The DISPLAY folds it, though: an input figure of 18.6M beside a cache figure
		* of 62.2M reads as though 62.2M went unaccounted for, and a cache read LARGER
		* than the input looks like a bug rather than the expected shape of a prefix
		* cache. So the headline shows the whole prompt side and the cache line becomes
		* a HIT count — a subset, which is why the two are never added together and the
		* old explanatory footnote is gone.
		* @param counters - one scope's counters.
		* @returns prompt tokens including the cached portion.
		*/
		function promptTokens(counters) {
			return counters.input + counters.cacheRead + counters.cacheWrite;
		}
		/**
		* Localized label for a reasoning level.
		*
		* Falls back to the raw id so a level added upstream is still usable rather than
		* rendering blank.
		*/
		function levelLabel(level, t) {
			switch (level) {
				case "low": return t("thinkingLevelLow");
				case "medium": return t("thinkingLevelMedium");
				case "high": return t("thinkingLevelHigh");
				default: return level;
			}
		}
		/**
		* Humanize a burn horizon (hours until a window runs dry at the sampled rate).
		*
		* Reuses the shared `rel*` magnitudes so the phrasing matches every other
		* duration on the panel; under an hour falls to minutes rather than rounding
		* to a false zero.
		*/
		function burnHorizon(hours, t) {
			if (hours < 1) return t("relMinutes", { n: Math.max(1, Math.round(hours * 60)) });
			if (hours < 48) return t("relHours", { n: Math.round(hours) });
			return t("relDays", { n: Math.round(hours / 24) });
		}
		/**
		* A wall-clock moment for a state label (a cooldown end).
		*
		* Time-of-day alone is enough while the wall is today; past midnight it must
		* carry the date, or a 24h quota cooldown reads as though it ends in a few
		* minutes. (`untilText` is the relative form, used where "how long from now" is
		* the question rather than "when".)
		*
		* `lang` is the UI language ('zh' | 'en'), not the browser locale: the words on
		* this panel follow the host's language setting, so the dates must too — a zh
		* panel rendering `9/24/2026` (the browser's en-US ordering) was the symptom.
		* `undefined` degrades to the browser default, the pre-`lang` behaviour.
		*/
		function clockTime(iso, lang) {
			if (iso === null) return "—";
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return "—";
			const now = /* @__PURE__ */ new Date();
			return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate() ? date.toLocaleTimeString(lang, {
				hour: "2-digit",
				minute: "2-digit"
			}) : date.toLocaleString(lang, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		/**
		* A ledger day key ('YYYY-MM-DD', local by construction) as a short label.
		* Parsed as LOCAL date parts — a UTC parse would shift the label a day for
		* half the planet.
		*/
		function dayLabel(day, lang) {
			const [y, m, d] = day.split("-").map(Number);
			if (y === void 0 || m === void 0 || d === void 0 || Number.isNaN(y)) return day;
			return new Date(y, m - 1, d).toLocaleDateString(lang, {
				month: "short",
				day: "numeric"
			});
		}
		/**
		* Localized label for a cooldown reason.
		*
		* Falls back to the raw token so a reason added on the host side still renders
		* something legible rather than blank.
		*/
		function cooldownReasonLabel(reason, t) {
			switch (reason) {
				case "network-error": return t("cooldownReasonNetworkError");
				case "quota-exhausted": return t("cooldownReasonQuotaExhausted");
				case "validation-required": return t("cooldownReasonValidationRequired");
				case "project-error": return t("cooldownReasonProjectError");
				default: return reason;
			}
		}
		/**
		* Ago label with seconds resolution, for the recent list. `agoText` collapses
		* the whole first minute into "just now", which is too coarse when the reader
		* is watching live activity — here the seconds carry the information.
		*/
		function recentAgo(at, now, t) {
			const diff = now - at;
			if (diff < 1e4) return t("relJustNow");
			if (diff < 6e4) return t("relSeconds", { n: Math.floor(diff / 1e3) });
			return agoText(new Date(at).toISOString(), t, now);
		}
		/**
		* Middle-truncate an identity for the recent list.
		*
		* Both ends carry the signal — an email's domain, a model id's tier suffix —
		* so the cut is taken from the MIDDLE, and bounding the rendered length (not
		* relying on CSS clipping of a `table-layout: fixed` cell) is what keeps the
		* columns honest. The full value stays on the cell's title.
		* @param text - the full identity.
		* @param max - rendered character budget including the ellipsis.
		* @returns the truncated display string.
		*/
		function truncateIdentity(text, max = 22) {
			if (text.length <= max) return text;
			const head = Math.ceil((max - 1) / 2);
			const tail = max - 1 - head;
			return `${text.slice(0, head)}…${text.slice(-tail)}`;
		}
		/**
		* A host-styled button.
		*
		* Delegates to the host's `Button` so focus rings, disabled states, size tiers
		* and theming are the platform's rather than an imitation. `danger` has no
		* primitive equivalent, so it keeps the ghost family with a local class.
		*
		* Every click stops propagating. Account rows are themselves click targets
		* (selecting the row), so without this a row's "Delete"/"Verify"/"Activate"
		* button also selected that row — and for Delete the row indices then shifted
		* underneath a selection that was about to be acted on. Stopping unconditionally
		* is safe for buttons outside rows, where there is no ancestor handler.
		*/
		function button(label, onClick, options = {}) {
			return h(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: options.variant === "danger" ? "outline" : options.variant ?? "outline",
				size: options.size === "sm" ? "sm" : "md",
				...options.disabled === true ? { disabled: true } : {},
				...options.title === void 0 ? {} : { title: options.title },
				...options.variant === "danger" ? { className: "agy-btn-danger" } : {},
				onClick: (event) => {
					event?.stopPropagation?.();
					onClick();
				}
			}, label);
		}
		/** Full-width quota row used by the (collapsible) model quota list. */
		/** Account state rendered with the host's state dot plus a tinted tag. */
		function stateBadge(state, label) {
			const dot = state === "active" ? "done" : state === "cooling" ? "warning" : "error";
			const tone = state === "active" ? "success" : state === "cooling" ? "warning" : "danger";
			return h("span", { className: "agy-state" }, h(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
				state: dot,
				size: 8
			}), h(_deepseek_ai_dsh_client_ui_primitives.Tag, { tone }, label));
		}
		function subhead(title, aside) {
			return h("div", { className: "agy-subhead" }, h("span", null, title), aside === void 0 || aside === "" ? null : h("span", { className: "agy-aside" }, aside));
		}
		function hint(text) {
			return h("p", { className: "agy-hint" }, text);
		}
		function table(headers, rows) {
			return h("table", { className: "agy-table" }, headers === null ? null : h("thead", null, headers), h("tbody", null, ...rows));
		}
		/** A titled grouping surface. Grouping is what keeps a dense page readable. */
		function card(title, body, aside) {
			return h("section", { className: "agy-card" }, h("div", { className: "agy-card-head" }, h("span", { className: "agy-card-title" }, title), aside === void 0 ? null : h("span", { className: "agy-aside" }, aside)), h("div", { className: "agy-card-body" }, body));
		}
		/** A metric strip inside a card. */
		function metrics(cells) {
			return h("div", { className: "agy-metrics" }, ...cells);
		}
		/** One metric cell: a label, a large value, and an optional detail line. */
		function metric(label, value, detail) {
			const text = typeof value === "number" ? tokenText(value) : value;
			const match = /^([\d.]+)([MK]?)$/.exec(text);
			return h("div", { className: "agy-metric" }, h("div", { className: "agy-metric-k" }, label), h("div", { className: "agy-metric-v" }, match === null ? text : match[1], match !== null && match[2] !== "" ? h("small", null, match[2]) : null), h("div", { className: "agy-metric-d" }, detail));
		}
		/** Definition rows: label/value pairs with hairline separators. */
		function defs(rows) {
			return h("dl", { className: "agy-defs" }, ...rows.flatMap(([label, value], index) => [h("dt", { key: `k${index}` }, label), h("dd", { key: `v${index}` }, value)]));
		}
		/** One account's detail: identity, cumulative usage, proxy, and its actions. */
		function AccountDetail(props) {
			const { account, busy, handlers, t } = props;
			const [proxyDraft, setProxyDraft] = (0, react.useState)("");
			const usage = account.usage;
			const now = Date.now();
			const throughput = usage === null ? null : throughputTokenPerSecond(usage.totals);
			const identityRows = [
				[t("fieldProject"), account.projectId ?? t("noProject")],
				[t("fieldProxy"), h("span", { className: "agy-mono" }, account.proxy ?? t("proxyDirect"))],
				[t("fieldFingerprint"), account.fingerprint === null ? t("fingerprintNone") : t("fingerprintRegenerated", {
					count: account.fingerprintHistory,
					date: new Date(account.fingerprint.createdAt).toLocaleDateString(props.lang)
				})],
				...account.cooldownReason === null ? [] : [[t("fieldCooldownReason"), `${cooldownReasonLabel(account.cooldownReason, t)} · ${agoText(account.cooldownSetAt, t, now)}`]],
				[t("fieldSources"), usage === null ? t("noProject") : t("sourcesSummary", {
					chat: usage.sources.chat,
					cli: usage.sources.cli,
					verify: usage.sources.verify,
					test: usage.sources.test
				})],
				[t("fieldLatency"), usage === null ? t("noProject") : `${t("latencyAverage", { value: formatDuration(average(usage.totals.latencyMs, usage.totals.latencyN)) })} · ${t("latencyTtft", { value: formatDuration(average(usage.totals.ttftMs, usage.totals.ttftN)) })}`],
				...throughput === null ? [] : [[t("fieldThroughput"), `${t("throughputValue", { n: throughput })} · ${t("throughputNote")}`]]
			];
			if (account.state === "disabled") identityRows.push([t("fieldDisabled"), account.disabledAt === null ? t("disabledCredentials") : `${t("disabledCredentials")} · ${t("disabledSince", { ago: agoText(account.disabledAt, t, now) })}`]);
			if (account.verificationRequired) identityRows.push([t("fieldVerification"), account.verificationUrl === null ? t("verificationNoUrl") : h("a", {
				className: "agy-link",
				href: account.verificationUrl,
				target: "_blank",
				rel: "noreferrer noopener"
			}, t("verificationOpen"))]);
			const identity = card(t("detailTitle"), h("div", null, defs(identityRows), account.state === "disabled" ? hint(t("disabledHint")) : null), account.email ?? `#${account.index}`);
			const actions = card(t("colActions"), h("div", { className: "agy-actions" }, button(t("actionTest"), () => {
				handlers.onTest(account.index);
			}, { disabled: busy }), button(t("actionExport"), () => {
				handlers.onExport(account.index);
			}, { disabled: busy }), button(t("actionRegenerateFingerprint"), () => {
				handlers.onRegenerateFingerprint(account.index);
			}, { disabled: busy }), button(t("actionDelete"), () => {
				handlers.onDelete(account.index);
			}, {
				variant: "danger",
				disabled: busy
			})));
			/**
			* The 5-hour / weekly windows, placed ABOVE the cumulative usage card.
			*
			* Ordering is deliberate: these are the figures a user actually acts on
			* (the rolling budget still available), while cumulative usage is a
			* retrospective total that only grows. Putting the actionable number first is
			* the whole point of the panel.
			*
			* A window with no reported fraction renders its bar empty and its percentage
			* as an em dash — "unknown" must not look like "0% left". A null `limits` means
			* the account has not been measured YET, and says so rather than showing an
			* empty card. That is reachable at any pool size: `refreshLimits` runs for a
			* solo account too (unlike the scheduling quota refresh, which a pool of one
			* skips because measuring it could block the only account).
			*/
			const limitsBlock = card(t("limitsTitle"), account.limits === null || account.limits.length === 0 ? h("div", { className: "agy-empty" }, t("limitsUnavailable")) : h("div", { className: "agy-limits" }, account.limitsUpdatedAt === null ? null : h("div", { className: "agy-limit-age" }, t("limitsMeasured", { ago: agoText(new Date(account.limitsUpdatedAt).toISOString(), t, now) })), ...account.limits.map((group) => h("div", {
				className: "agy-limit-group",
				key: group.name
			}, h("div", { className: "agy-limit-group-name" }, group.name), ...group.windows.map((window) => {
				const fraction = window.remainingFraction;
				const burn = account.limitBurn?.[window.bucketId];
				const hoursLeft = fraction !== null && burn !== void 0 && burn > 0 ? fraction / burn : null;
				const resetHours = window.resetTime === null ? null : (new Date(window.resetTime).getTime() - now) / HOUR_MS;
				const exhaustsFirst = hoursLeft !== null && resetHours !== null && hoursLeft < resetHours;
				return h("div", { key: window.bucketId }, h("div", { className: "agy-limit-row" }, h("span", { className: "agy-limit-k" }, windowLabel(window.window, t)), h("span", { className: "agy-limit-track" }, fraction === null ? null : h("i", { style: {
					width: `${Math.round(fraction * 100)}%`,
					background: quotaColor(fraction)
				} })), h("span", { className: "agy-limit-p" }, fraction === null ? t("valueUnknown") : `${Math.round(fraction * 100)}%`), h("span", { className: "agy-limit-reset" }, window.resetTime === null ? null : formatQuotaReset(window.window, window.resetTime, t, now, props.detailedQuotaReset))), exhaustsFirst ? h("div", { className: "agy-limit-burn" }, t("limitBurnWarn", { value: burnHorizon(hoursLeft, t) })) : null);
			})))));
			const usageBlock = usage === null ? null : card(t("usageCumulative"), metrics([
				metric(t("kpiInput"), promptTokens(usage.totals), t("kpiInputMissed", { tokens: tokenText(usage.totals.input) })),
				metric(t("kpiOutput"), usage.totals.output, t("kpiOutputDetail")),
				metric(t("kpiCacheRead"), usage.totals.cacheRead, t("kpiCacheHit", { percent: cacheHitPercent(usage.totals) ?? 0 })),
				metric(t("kpiRequests"), String(usage.totals.requests), t("kpiRequestsDetail", {
					succeeded: usage.totals.succeeded,
					failed: usage.totals.failed
				}))
			]));
			const saveProxy = () => {
				const value = proxyDraft.trim();
				if (value === "") return;
				handlers.onSetProxy(account.index, value);
				setProxyDraft("");
			};
			return h("div", { className: "agy-detail" }, identity, actions, limitsBlock, usageBlock, card(t("fieldProxy"), h("div", { className: "agy-actions" }, h(_deepseek_ai_dsh_client_ui_primitives.Input, {
				value: proxyDraft,
				placeholder: t("proxyPlaceholder"),
				onChange: (event) => {
					setProxyDraft(event.target.value);
				}
			}), button(t("actionSave"), saveProxy, { disabled: busy || proxyDraft.trim() === "" }), button(t("actionClear"), () => {
				handlers.onSetProxy(account.index, "");
				setProxyDraft("");
			}, { disabled: busy || account.proxy === null }), (() => {
				const noTarget = proxyDraft.trim() === "" && account.proxy === null;
				return button(t("actionTestProxy"), () => {
					handlers.onTestProxy(account.index, proxyDraft.trim());
				}, {
					disabled: busy || noTarget,
					...noTarget ? { title: t("proxyTestNoTarget") } : {}
				});
			})())));
		}
		/**
		* Whether the row should offer "set as current".
		*
		* A pure rule, exported for a direct unit test. Two cases hide the action:
		* the account is already the pool's preference, or it is DISABLED — `activate`
		* only writes the preference and cannot re-enable, so on a disabled row the
		* button was a no-op the user would read as broken. The repair path for a
		* button was a no-op the user would read as broken. The repair path for a
		* disabled account is `actionVerify`, which stays on the row.
		*/
		function canActivateAccount(account) {
			return !account.active && account.state !== "disabled";
		}
		/**
		* Pick the selected account index: defaults to the active account (badge "current")
		* when present, otherwise falls back to index 0. Clamps to valid bounds.
		*/
		function resolveSelectedAccountIndex(accounts, selected) {
			if (accounts.length === 0) return 0;
			if (selected !== null) {
				if (selected >= 0 && selected < accounts.length) return selected;
				const activePos = accounts.findIndex((a) => a.active);
				return activePos >= 0 ? activePos : Math.min(Math.max(selected, 0), accounts.length - 1);
			}
			const activePos = accounts.findIndex((a) => a.active);
			return activePos >= 0 ? activePos : 0;
		}
		function PreferencesCard(props) {
			const { rpc, t, onBadgePrefChange, onDetailedPrefChange } = props;
			const [badgeEnabled, setBadgeEnabled] = (0, react.useState)(false);
			const [detailedReset, setDetailedReset] = (0, react.useState)(false);
			const [loading, setLoading] = (0, react.useState)(true);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saveError, setSaveError] = (0, react.useState)(null);
			const errorTimer = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => () => {
				if (errorTimer.current !== void 0) clearTimeout(errorTimer.current);
			}, []);
			(0, react.useEffect)(() => {
				let active = true;
				rpc.call("ui.prefs.get", {}).then((prefs) => {
					if (active) {
						setBadgeEnabled(prefs?.conversationBadge === true);
						setDetailedReset(prefs?.detailedQuotaReset === true);
						onDetailedPrefChange?.(prefs?.detailedQuotaReset === true);
						setLoading(false);
					}
				}).catch(() => {
					if (active) setLoading(false);
				});
				return () => {
					active = false;
				};
			}, [rpc, onDetailedPrefChange]);
			const toggleBadge = (0, react.useCallback)(async (checked) => {
				setSaving(true);
				setBadgeEnabled(checked);
				if (errorTimer.current !== void 0) clearTimeout(errorTimer.current);
				try {
					const res = await rpc.call("ui.prefs.set", { conversationBadge: checked });
					setBadgeEnabled(res.conversationBadge);
					setSaveError(null);
					onBadgePrefChange?.(res.conversationBadge);
					if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("agy:ui-prefs-changed", { detail: res }));
				} catch (err) {
					setBadgeEnabled(!checked);
					setSaveError(t("prefSaveFailed", { message: err instanceof Error ? err.message : String(err) }));
					errorTimer.current = setTimeout(() => setSaveError(null), ACTION_MESSAGE_TTL_MS);
				} finally {
					setSaving(false);
				}
			}, [
				rpc,
				t,
				onBadgePrefChange
			]);
			const toggleDetailed = (0, react.useCallback)(async (checked) => {
				setSaving(true);
				setDetailedReset(checked);
				if (errorTimer.current !== void 0) clearTimeout(errorTimer.current);
				try {
					const res = await rpc.call("ui.prefs.set", { detailedQuotaReset: checked });
					setDetailedReset(res.detailedQuotaReset);
					setSaveError(null);
					onDetailedPrefChange?.(res.detailedQuotaReset);
					if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("agy:ui-prefs-changed", { detail: res }));
				} catch (err) {
					setDetailedReset(!checked);
					setSaveError(t("prefSaveFailed", { message: err instanceof Error ? err.message : String(err) }));
					errorTimer.current = setTimeout(() => setSaveError(null), ACTION_MESSAGE_TTL_MS);
				} finally {
					setSaving(false);
				}
			}, [
				rpc,
				t,
				onDetailedPrefChange
			]);
			return h("section", { className: "agy-card" }, h("div", { className: "agy-card-body" }, ...[h("div", {
				className: "agy-pref-row",
				key: "detailed"
			}, h("div", { className: "agy-pref-info" }, h("div", { className: "agy-pref-name" }, t("prefDetailedQuotaReset")), h("div", { className: "agy-pref-desc" }, t("prefDetailedQuotaResetDesc"))), h(_deepseek_ai_dsh_client_ui_primitives.Switch, {
				label: t("prefDetailedQuotaReset"),
				checked: detailedReset,
				disabled: loading || saving,
				onChange: (checked) => void toggleDetailed(checked)
			})), h("div", {
				className: "agy-pref-row",
				key: "badge"
			}, h("div", { className: "agy-pref-info" }, h("div", { className: "agy-pref-name" }, t("prefConversationBadge")), h("div", { className: "agy-pref-desc" }, t("prefConversationBadgeDesc"))), h(_deepseek_ai_dsh_client_ui_primitives.Switch, {
				label: t("prefConversationBadge"),
				checked: badgeEnabled,
				disabled: loading || saving,
				onChange: (checked) => void toggleBadge(checked)
			}))], saveError === null ? null : h("div", { className: "agy-error" }, saveError)));
		}
		function AccountsTab(props) {
			const { accounts, busy, handlers, t } = props;
			const [selected, setSelected] = (0, react.useState)(null);
			const selectedRef = (0, react.useRef)(null);
			const now = Date.now();
			/**
			* The live line: who is serving right now, and how much.
			*
			* Present ONLY while something is in flight — an idle pool renders no strip,
			* so the quiet state stays quiet. The dot is the host `StateDot`'s ongoing
			* state, so the animation is the platform's.
			*/
			const liveLine = props.busyNow.length === 0 ? null : (() => {
				const total = props.busyNow.reduce((sum, entry) => sum + entry.count, 0);
				const [first] = props.busyNow;
				const subject = first === void 0 ? "" : first.email ?? `#${first.index}`;
				return h("div", { className: "agy-live" }, h(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
					state: "ongoing",
					size: 8
				}), h("span", null, props.busyNow.length === 1 ? t("liveOne", {
					email: subject,
					count: total
				}) : t("liveMany", {
					count: total,
					accounts: props.busyNow.length
				})));
			})();
			const index = resolveSelectedAccountIndex(accounts, selected);
			const current = accounts[index];
			(0, react.useEffect)(() => {
				selectedRef.current?.scrollIntoView?.({ block: "nearest" });
			}, [index]);
			if (accounts.length === 0) return card(t("colAccount"), h("div", { className: "agy-empty" }, t("emptyAccounts")));
			const rows = accounts.map((account, at) => h("div", {
				key: String(account.index),
				ref: at === index ? selectedRef : void 0,
				className: "agy-rowitem",
				"data-clickable": "true",
				"data-selected": at === index,
				role: "button",
				tabIndex: 0,
				"aria-pressed": at === index,
				onClick: () => {
					setSelected(at);
				},
				onKeyDown: (event) => {
					if (event.key !== "Enter" && event.key !== " ") return;
					event.preventDefault();
					setSelected(at);
				}
			}, h("div", { className: "agy-rowmain" }, h("div", { className: "agy-rowtitle" }, h("span", { className: "agy-rowname" }, account.email ?? `#${account.index}`), account.active ? h(_deepseek_ai_dsh_client_ui_primitives.Tag, { tone: "info" }, t("currentAccount")) : null), h("div", { className: "agy-rowmeta" }, account.projectId ?? t("noProject"), account.usage === null || account.usage.totals.requests === 0 ? null : ` · ${t("rowRequestsTotal", { n: account.usage.totals.requests })}`, account.usage === null || account.usage.lastUsedAt === null ? null : ` · ${t("lastActive", { ago: agoText(new Date(account.usage.lastUsedAt).toISOString(), t, now) })}`)), h("div", { className: "agy-rowactions" }, stateBadge(account.state, account.state === "cooling" ? `${t("coolingUntil")} ${clockTime(account.cooldownUntil, props.lang)}` : account.state === "verification-required" ? t("verificationRetry", { time: clockTime(account.cooldownUntil, props.lang) }) : stateLabel(account.state, t)), canActivateAccount(account) ? button(t("actionActivate"), () => {
				setSelected(at);
				handlers.onActivate(account.index);
			}, {
				size: "sm",
				disabled: busy
			}) : null, button(t("actionVerify"), () => {
				handlers.onVerify(account.index);
			}, {
				size: "sm",
				disabled: busy
			}))));
			return h("div", { className: "agy-root" }, h("div", { className: "agy-split-wrap" }, h("div", { className: "agy-split" }, card(t("colAccount"), h("div", null, liveLine, h("div", { className: "agy-rows" }, ...rows)), `${accounts.length}`), current === void 0 ? null : h(AccountDetail, {
				key: String(current.index),
				account: current,
				busy,
				handlers: {
					...handlers,
					onDelete: (index) => {
						setSelected(null);
						handlers.onDelete(index);
					}
				},
				lang: props.lang,
				t,
				detailedQuotaReset: props.detailedQuotaReset
			})), h(RecentCard, {
				rpc: props.rpc,
				t
			}), h(PreferencesCard, {
				rpc: props.rpc,
				t,
				onBadgePrefChange: props.onBadgePrefChange,
				onDetailedPrefChange: props.onDetailedPrefChange
			})));
		}
		/**
		* Models tab: per-model visibility switches, plus the account's model quota in a
		* collapsible block.
		*
		* Quota lives here rather than in the account list because both answer the same
		* question — "which models can I use, and how much is left" — and the quota list
		* is long (20+ rows), so it must not push the account list off screen. The
		* disclosure keeps it one click away without spending the space by default.
		*/
		/**
		* Order models for display: enabled first, disabled sunk to the bottom.
		*
		* Exported for a direct unit test — the rule is pure and worth pinning, and the
		* client test harness does not render. Stable by construction: `Array.sort` is
		* stable per spec, so the host's own order survives inside each group. That is
		* what makes a toggle move exactly one row instead of reshuffling the list.
		* @param models - the host's list, in host order.
		* @returns a new array, enabled models first.
		*/
		function orderModels(models) {
			return [...models].sort((a, b) => Number(a.disabled) - Number(b.disabled));
		}
		function ModelsTab(props) {
			const { models, account, pending, testing, onToggle, onTestModel, t } = props;
			const ordered = (0, react.useMemo)(() => orderModels(models), [models]);
			if (models.length === 0) return card(t("modelsTitle"), h("div", { className: "agy-empty" }, t("emptyModels")));
			const hidden = models.filter((model) => model.disabled).length;
			const rows = ordered.map((model) => h("div", {
				className: "agy-rowitem",
				key: model.id
			}, h("div", { className: "agy-rowmain" }, h("div", { className: "agy-rowtitle" }, h("span", { className: "agy-rowname" }, model.name)), model.name === model.id ? null : h("div", { className: "agy-rowmeta agy-mono" }, model.id)), h("div", { className: "agy-rowactions" }, button(testing.has(model.id) ? t("modelTesting") : t("actionTestModel"), () => {
				onTestModel(model.id);
			}, {
				size: "sm",
				variant: "ghost",
				disabled: testing.has(model.id)
			}), h(_deepseek_ai_dsh_client_ui_primitives.Switch, {
				checked: !model.disabled,
				disabled: pending.has(model.id),
				label: t("modelToggleAria", { name: model.name }),
				onChange: () => {
					onToggle(model.id, !model.disabled);
				}
			}))));
			return h("div", { className: "agy-root" }, card(t("modelsTitle"), h("div", { className: "agy-rows" }, ...rows), hidden > 0 ? t("modelsHiddenSuffix", { count: hidden }) : account ?? void 0), hint(t("modelsHelp")));
		}
		/**
		* One budget row: label, input, and optional shortcut chips.
		*
		* There is deliberately NO trailing text column. An earlier version put the wire
		* form there ("sends thinkingLevel: high"), which was wrong twice over: on the
		* "High" row it restated that row's own label, and `thinkingLevel` /
		* `thinkingBudget` are identifiers for us rather than words a user needs. The
		* input plus its label carry all the information the row has.
		*
		* `chips` are shortcuts, not a second control: they only fill the input, and the
		* empty one is the meaningful default (upstream allocates).
		*/
		function thinkingRow(id, label, value, t, handlers) {
			return h("div", {
				className: "agy-thinking-row",
				key: id
			}, h("span", { className: "agy-thinking-k" }, label), h(_deepseek_ai_dsh_client_ui_primitives.Input, {
				value,
				placeholder: t("thinkingAuto"),
				inputMode: "numeric",
				onChange: (event) => {
					handlers.onInput(event.target.value);
				},
				onBlur: (event) => {
					handlers.onCommit(event.target.value);
				}
			}), handlers.chips === void 0 ? null : h("span", { className: "agy-thinking-chips" }, ...handlers.chips.map((chip) => h("button", {
				key: chip.label,
				type: "button",
				className: "agy-thinking-chip",
				onClick: () => {
					handlers.onInput(chip.value);
					handlers.onCommit(chip.value);
				}
			}, chip.label))));
		}
		/**
		* Measured thinking-token samples, one row per effort THE PICKER ACTUALLY OFFERS.
		*
		* The rows are exactly the picker's entries — Default, Low, Medium, High — and
		* nothing else. `Max` is deliberately absent: it was a chip that filled the input
		* with the maximum, and measurement showed it buys nothing. At the model's real
		* ceiling (65536) `high` reaches ~63k, i.e. 96% of it, so there is no higher
		* ceiling for a bigger number to unlock.
		*
		* WHY A TABLE AND NOT A SENTENCE. These numbers only mean anything compared
		* DOWN a column: `High` spends ~165 tokens on `17*23` and ~63,000 on a hard
		* derivation. A sentence listing both is unreadable, and a single number per tier
		* reads as a fixed value when the real behaviour is a range.
		*
		* MEASUREMENT TRAP, recorded because it wasted a full investigation: thinking and
		* output SHARE `maxOutputTokens` (measured exactly — cap 2048 gave 1962 thoughts
		* + 82 output = 2044). A harness that pins the cap below the thinking demand
		* measures its own pin. Six runs at cap 60000 all reported ~24k regardless of
		* level and looked like "the tiers are equivalent"; at cap 65536 they separate.
		* The hard column below was re-measured at the ceiling. `pnpm run
		* verify:thinking-levels` re-derives all of it.
		*
		* A `0` is a MEASURED ZERO, not a placeholder: on the medium prompt `Low`
		* returned no `thoughtsTokenCount` field at all, and `total - output` equalled
		* the prompt size in all 5 runs — upstream really spent no thinking tokens. It is
		* printed as `0` rather than `-` so the row does not look like missing data.
		*
		* Every value is the mean of 2-11 live samples, rounded. `Default`'s hard cell
		* carried only 2 samples (34k and 57k, 51% apart) until four more were taken:
		* 6 samples now give ~48,700 at sd ~8,800. The spread is why these are labelled
		* samples and not a specification.
		*/
		const THINKING_SAMPLES = [
			{
				level: "Default",
				easy: 135,
				medium: 1100,
				hard: 48700
			},
			{
				level: "Low",
				easy: 50,
				medium: 0,
				hard: 9e3
			},
			{
				level: "Medium",
				easy: 150,
				medium: 870,
				hard: 60400
			},
			{
				level: "High",
				easy: 165,
				medium: 1855,
				hard: 63400
			},
			{
				level: "max",
				easy: 185,
				medium: 2130,
				hard: 62900
			}
		];
		/**
		* Collapsible table of measured thinking tokens.
		*
		* MUST be rendered as a component (`h(ThinkingSamples, { t })`), never CALLED as
		* `ThinkingSamples({ t })` or as a lowercase helper. This function owns a
		* `useState`, and React keys renderer state by hook call order: a direct call
		* inside the parent's conditional branch appends this hook to the PARENT's
		* sequence, so the parent's hook count changes the moment the section expands and
		* React throws mid-render. The exception unmounts the whole Settings tree — a
		* white panel no click can revive, only a restart.
		*
		* This is the second occurrence of that class of bug in this file (`ModelsTab`
		* ran a `useMemo` after an early return, white-screening on tab switch). Both
		* passed `tsc`, the 442 unit tests and CI, because the test environment is
		* `environment: 'node'` and renders nothing — nothing static checks hook order.
		*/
		function ThinkingSamples({ t }) {
			const [show, setShow] = (0, react.useState)(false);
			const cell = (value) => h("td", { className: "agy-num" }, value === null ? "-" : value === 0 ? "0" : `~${value.toLocaleString()}`);
			return h("div", {
				className: "agy-disclosure",
				"data-open": show
			}, h("button", {
				type: "button",
				className: "agy-disclosure-toggle",
				"aria-expanded": show,
				onClick: () => {
					setShow(!show);
				}
			}, h("span", { className: "agy-caret" }), h("span", null, t("thinkingSamplesTitle"))), show ? h("div", { className: "agy-disclosure-body" }, h("p", { className: "agy-hint" }, t("thinkingSamplesIntro")), h("p", { className: "agy-hint" }, t("thinkingSamplesCaption")), h("div", { className: "agy-table-wrap" }, table(h("tr", null, h("th", null, t("thinkingSamplesLevel")), h("th", { className: "agy-num" }, t("thinkingSamplesEasy")), h("th", { className: "agy-num" }, t("thinkingSamplesMedium")), h("th", { className: "agy-num" }, t("thinkingSamplesHard"))), THINKING_SAMPLES.map((row) => h("tr", { key: row.level }, h("td", { className: "agy-strong" }, row.level === "max" ? t("thinkingSamplesMaxRow") : row.level), cell(row.easy), cell(row.medium), cell(row.hard))))), h("p", { className: "agy-hint agy-table-note" }, t("thinkingSamplesComparison")), h("p", { className: "agy-hint agy-table-note" }, t("thinkingSamplesSources")), h("p", { className: "agy-hint agy-table-note" }, t("thinkingSamplesZero"))) : null);
		}
		/**
		* The global reasoning-level token budgets, on the config tab.
		*
		* One row per level rather than per model: only `*-tiered` models send a
		* `thinkingConfig` at all, and the level itself is already chosen in DSH's model
		* selector. So this supplies the missing VALUE behind each level — the same three
		* numbers for every such model.
		*
		* An EMPTY input is the meaningful default: the request then sends
		* `thinkingLevel` and lets upstream pick, which is exactly the behaviour before
		* this setting existed. That is why the field is not a `number` input with a
		* zero fallback, and why clearing it is a real action rather than "set to 0"
		* (measured: `0` reduces thinking but does not reliably disable it).
		*/
		function ThinkingBudgetCard(props) {
			const { rpc, t } = props;
			const [budgets, setBudgets] = (0, react.useState)({});
			const [tieredBudget, setTieredBudget] = (0, react.useState)(null);
			const [claudeBudget, setClaudeBudget] = (0, react.useState)(null);
			const [claudeDraft, setClaudeDraft] = (0, react.useState)("");
			const [drafts, setDrafts] = (0, react.useState)({});
			const [open, setOpen] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(void 0);
			const [loaded, setLoaded] = (0, react.useState)(false);
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
				};
			}, []);
			const load = (0, react.useCallback)(() => {
				(async () => {
					try {
						const result = await rpc.call("thinking.get", {});
						if (!alive.current) return;
						setBudgets(result.budgets);
						setTieredBudget(result.tieredBudget);
						setDrafts((c) => ({
							...c,
							tiered: result.tieredBudget === null ? "" : String(result.tieredBudget)
						}));
						setClaudeBudget(result.claudeBudget);
						setClaudeDraft(result.claudeBudget === null ? "" : String(result.claudeBudget));
						setDrafts(Object.fromEntries(THINKING_LEVELS.map((level) => [level, result.budgets[level] === void 0 ? "" : String(result.budgets[level])])));
						setError(void 0);
					} catch (caught) {
						if (!alive.current) return;
						setError(caught instanceof Error ? caught.message : String(caught));
					} finally {
						if (alive.current) setLoaded(true);
					}
				})();
			}, [rpc]);
			(0, react.useEffect)(() => {
				if (open && !loaded) load();
			}, [
				open,
				loaded,
				load
			]);
			const save = (level, raw) => {
				const trimmed = raw.trim();
				const value = trimmed === "" ? null : Number(trimmed);
				if (value !== null && !Number.isInteger(value)) {
					setError(t("thinkingInvalid"));
					return;
				}
				(async () => {
					try {
						const result = await rpc.call("thinking.set", {
							level,
							budget: value
						});
						if (!alive.current) return;
						setBudgets(result.budgets);
						setError(void 0);
					} catch (caught) {
						if (!alive.current) return;
						setError(caught instanceof Error ? caught.message : String(caught));
					}
				})();
			};
			const saveTiered = (raw) => {
				const trimmed = raw.trim();
				const value = trimmed === "" ? null : Number(trimmed);
				if (value !== null && !Number.isInteger(value)) {
					setError(t("thinkingInvalid"));
					return;
				}
				(async () => {
					try {
						const result = await rpc.call("thinking.setTiered", { budget: value });
						if (!alive.current) return;
						setTieredBudget(result.tieredBudget);
						setError(void 0);
					} catch (caught) {
						if (!alive.current) return;
						setError(caught instanceof Error ? caught.message : String(caught));
					}
				})();
			};
			const saveClaude = (raw) => {
				const trimmed = raw.trim();
				const value = trimmed === "" ? null : Number(trimmed);
				if (value !== null && !Number.isInteger(value)) {
					setError(t("thinkingInvalid"));
					return;
				}
				(async () => {
					try {
						const result = await rpc.call("thinking.setClaude", { budget: value });
						if (!alive.current) return;
						setClaudeBudget(result.claudeBudget);
						setError(void 0);
					} catch (caught) {
						if (!alive.current) return;
						setError(caught instanceof Error ? caught.message : String(caught));
					}
				})();
			};
			const configured = THINKING_LEVELS.filter((level) => budgets[level] !== void 0).length + (tieredBudget === null ? 0 : 1);
			const block = h("div", {
				className: "agy-disclosure",
				"data-open": open
			}, h("button", {
				type: "button",
				className: "agy-disclosure-toggle",
				"aria-expanded": open,
				onClick: () => {
					setOpen(!open);
				}
			}, h("span", { className: "agy-caret" }), h("span", null, t("thinkingTitle")), h("span", { className: "agy-disclosure-meta" }, configured === 0 ? t("thinkingDefaultAll") : t("thinkingConfigured", { count: configured }))), open ? h("div", { className: "agy-disclosure-body" }, error === void 0 ? null : h("div", { className: "agy-error" }, error), h("div", { className: "agy-thinking-group" }, h("div", { className: "agy-thinking-group-name" }, t("thinkingGeminiGroup")), h("p", { className: "agy-hint" }, t("thinkingGeminiHint")), h("ul", { className: "agy-thinking-notes agy-thinking-effects" }, h("li", null, t("thinkingEffectLowUp")), h("li", null, t("thinkingEffectHighDown")), h("li", null, t("thinkingEffectMax")), h("li", null, t("thinkingEffectReset")), h("li", null, t("thinkingEffectProLevels"))), thinkingRow("tiered", t("thinkingTieredLabel"), drafts.tiered ?? "", t, {
				onInput: (value) => {
					setDrafts((c) => ({
						...c,
						tiered: value
					}));
				},
				onCommit: (value) => {
					const stored = tieredBudget === null ? "" : String(tieredBudget);
					if (value.trim() !== stored) saveTiered(value);
				},
				chips: [{
					label: t("thinkingChipClear"),
					value: ""
				}]
			}), ...THINKING_LEVELS.map((level) => thinkingRow(level, levelLabel(level, t), drafts[level] ?? "", t, {
				onInput: (value) => {
					setDrafts((c) => ({
						...c,
						[level]: value
					}));
				},
				onCommit: (value) => {
					const stored = budgets[level] === void 0 ? "" : String(budgets[level]);
					if (value.trim() !== stored) save(level, value);
				}
			})), h(ThinkingSamples, { t })), h("div", { className: "agy-thinking-group" }, h("div", { className: "agy-thinking-group-name" }, t("thinkingClaudeGroup")), h("ul", { className: "agy-thinking-notes" }, h("li", null, t("thinkingClaudeNoLevels", {
				min: CLAUDE_BUDGET_MIN,
				max: CLAUDE_BUDGET_MAX
			})), h("li", null, t("thinkingClaudeMaxTokens")), h("li", null, t("thinkingClaudeNoReport"))), thinkingRow("claude", t("thinkingClaudeLabel"), claudeDraft, t, {
				onInput: (value) => {
					setClaudeDraft(value);
				},
				onCommit: (value) => {
					const stored = claudeBudget === null ? "" : String(claudeBudget);
					if (value.trim() !== stored) saveClaude(value);
				},
				chips: [{
					label: t("thinkingChipClear"),
					value: ""
				}]
			}))) : null);
			return card(t("thinkingTitle"), block);
		}
		/**
		* The config tab: a card container, not one component.
		*
		* Each card loads and saves its OWN state (the thinking card already had that
		* shape), so a new knob is a new card rather than a field threaded through a
		* shared form — and one card's failed load cannot blank the others. Nothing here
		* holds cross-card state, which is the property that keeps that true.
		*/
		function ConfigTab(props) {
			const { rpc, t } = props;
			return h("div", { className: "agy-root" }, h(ThinkingBudgetCard, {
				rpc,
				t
			}), h(MultimodalCard, {
				rpc,
				t
			}));
		}
		/**
		* The per-file inline cap for non-image multimodal files.
		*
		* A plain card, not a disclosure like the thinking block: it is one number, so
		* there is nothing to collapse, and the same self-loading shape as the thinking
		* card (load on mount, draft mirrored as a string, blur commits).
		*
		* The EMPTY semantics are inherited deliberately: an empty box means "no stored
		* setting", which falls back to the env override or the 20MB default. That is
		* why clearing has its own button rather than being reachable only by emptying
		* the field — the destructive direction should be an explicit click, not the
		* side effect of a blur on a field the user emptied while deciding.
		*/
		function MultimodalCard(props) {
			const { rpc, t } = props;
			const [view, setView] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)(void 0);
			const [loaded, setLoaded] = (0, react.useState)(false);
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
				};
			}, []);
			const load = (0, react.useCallback)(() => {
				(async () => {
					try {
						const result = await rpc.call("multimodal.get", {});
						if (!alive.current) return;
						setView(result);
						setDraft(result.value === null ? "" : String(result.value));
						setError(void 0);
					} catch (caught) {
						if (!alive.current) return;
						setError(caught instanceof Error ? caught.message : String(caught));
					} finally {
						if (alive.current) setLoaded(true);
					}
				})();
			}, [rpc]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const commit = (value) => {
				(async () => {
					try {
						const result = await rpc.call("multimodal.set", { maxInlineMb: value });
						if (!alive.current) return;
						setView(result);
						setDraft(result.value === null ? "" : String(result.value));
						setError(void 0);
					} catch (caught) {
						if (!alive.current) return;
						setError(caught instanceof Error ? caught.message : String(caught));
					}
				})();
			};
			const save = (raw) => {
				const trimmed = raw.trim();
				if (trimmed === "") {
					commit(null);
					return;
				}
				const value = Number(trimmed);
				if (!Number.isInteger(value)) {
					setError(t("multimodalInvalid"));
					return;
				}
				if (value < 1 || value > 100) {
					setError(t("multimodalRange", {
						min: 1,
						max: 100
					}));
					return;
				}
				commit(value);
			};
			const source = view === null ? null : view.source === "env" ? t("multimodalSourceEnv") : view.source === "stored" ? t("multimodalSourceStored") : t("multimodalSourceDefault", { default: 20 });
			return card(t("multimodalTitle"), [
				h("div", { className: "agy-thinking-row" }, h("span", { className: "agy-thinking-k" }, t("multimodalLabel")), h(_deepseek_ai_dsh_client_ui_primitives.Input, {
					value: draft,
					placeholder: t("multimodalAuto"),
					inputMode: "numeric",
					disabled: !loaded,
					onChange: (event) => {
						setDraft(event.target.value);
					},
					onBlur: (event) => {
						save(event.target.value);
					}
				}), h("span", { className: "agy-input-unit" }, t("multimodalUnit"), h("button", {
					type: "button",
					className: "agy-thinking-chip",
					onClick: () => {
						setDraft("");
						commit(null);
					}
				}, t("multimodalClear")))),
				source === null ? null : h("div", { className: "agy-hint" }, source),
				hint(t("multimodalHint")),
				error === void 0 ? null : h("div", { className: "agy-error" }, error)
			]);
		}
		/** Result vocabulary for one recent row; rotation events are their own kind. */
		function recentResultKind(entry) {
			if (entry.kind === "rotation") return "rotation";
			if (entry.rateLimited) return "limited";
			if (!entry.ok) return "fail";
			return "ok";
		}
		/**
		* Localized label for a failure-classification token, falling back to the raw
		* token so a classification added upstream still reads as something.
		*
		* 'aborted' is the one token that is NOT an upstream classification (it marks a
		* turn the consumer cancelled), and it is listed here so the ring reads
		* "cancelled" rather than leaking the raw ledger token.
		*/
		function failureReasonLabel(reason, t) {
			switch (reason) {
				case "rate-limit": return t("colRateLimited");
				case "network-error": return t("cooldownReasonNetworkError");
				case "auth-failure": return t("disabledCredentials");
				case "verification-required": return t("cooldownReasonValidationRequired");
				case "quota-exhausted": return t("cooldownReasonQuotaExhausted");
				case "project-error": return t("cooldownReasonProjectError");
				case "aborted": return t("reasonAborted");
				default: return reason;
			}
		}
		/**
		* The result cell's text. Rotation rows say WHY (`reason` rides the record
		* since the ring captures the classification); a failed request with a
		* non-rate-limit classification also names it — the rate-limit case is already
		* the whole RateLimited label, and doubling it reads as a stutter.
		*/
		function recentResultText(entry, t) {
			const kind = recentResultKind(entry);
			if (kind === "rotation") return entry.reason === null ? t("colRotations") : `${t("colRotations")} · ${failureReasonLabel(entry.reason, t)}`;
			if (kind === "limited") return t("colRateLimited");
			if (kind === "fail") return entry.reason === null || entry.reason === "rate-limit" ? t("colFailed") : `${t("colFailed")} · ${failureReasonLabel(entry.reason, t)}`;
			return t("recentOk");
		}
		/**
		* The "what just happened" list: the most recent records this process saw,
		* newest first, collapsed by default and polled while open.
		*
		* A component (never called directly) — it owns hooks; see ThinkingSamples for
		* the hook-order rule this file has been bitten by twice. The poll is the same
		* 3s cadence as the live line and reads the host's memory ring, so an open
		* list costs nothing upstream.
		*/
		function RecentCard(props) {
			const { rpc, t } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [recent, setRecent] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(void 0);
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
				};
			}, []);
			const load = (0, react.useCallback)(() => {
				rpc.call("pool.recent", {}).then((result) => {
					if (alive.current) {
						setRecent(result.recent);
						setError(void 0);
					}
				}).catch((caught) => {
					if (alive.current) setError(caught instanceof Error ? caught.message : String(caught));
				});
			}, [rpc]);
			(0, react.useEffect)(() => {
				if (open && recent === null) load();
			}, [
				open,
				recent,
				load
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const timer = setInterval(() => {
					if (!document.hidden) load();
				}, POOL_POLL_INTERVAL_MS);
				return () => {
					clearInterval(timer);
				};
			}, [open, load]);
			const now = Date.now();
			return h("div", {
				className: "agy-disclosure agy-recent",
				"data-open": open
			}, h("button", {
				type: "button",
				className: "agy-disclosure-toggle",
				"aria-expanded": open,
				onClick: () => {
					setOpen(!open);
				}
			}, h("span", { className: "agy-caret" }), h("span", null, t("recentTitle")), recent === null ? null : h("span", { className: "agy-disclosure-meta" }, String(recent.length))), open === false ? null : h("div", { className: "agy-disclosure-body" }, error === void 0 ? null : h("div", { className: "agy-error" }, error), recent === null ? h("div", { className: "agy-empty" }, t("loading")) : recent.length === 0 ? h("div", { className: "agy-empty" }, t("recentEmpty")) : h("div", { className: "agy-table-wrap" }, table(h("tr", null, h("th", { style: { width: "64px" } }, t("colTime")), h("th", { style: { width: "30%" } }, t("colAccount")), h("th", { style: { width: "24%" } }, t("colModel")), h("th", { style: { width: "96px" } }, t("colResult")), h("th", { style: { width: "56px" } }, t("colDuration")), h("th", { style: { width: "48px" } }, t("colOutput"))), recent.map((entry, index) => h("tr", { key: `${entry.at}-${index}` }, h("td", null, recentAgo(entry.at, now, t)), h("td", null, h("span", {
				className: "agy-mail",
				title: entry.account ?? void 0
			}, entry.account === null ? "—" : truncateIdentity(entry.account))), h("td", null, h("span", {
				className: "agy-mail",
				title: entry.model ?? void 0
			}, entry.model === null ? "—" : truncateIdentity(entry.model))), h("td", null, h("span", {
				className: "agy-recent-state",
				"data-kind": recentResultKind(entry)
			}, recentResultText(entry, t))), h("td", null, entry.latencyMs === null ? "—" : formatDuration(entry.latencyMs)), h("td", { className: "agy-num" }, entry.output === null ? "—" : tokenText(entry.output))))))));
		}
		const RANGE_IDS = [
			"today",
			"week",
			"month",
			"all"
		];
		/** Localized label for one range chip. */
		function rangeLabel(id, t) {
			switch (id) {
				case "today": return t("rangeToday");
				case "week": return t("rangeWeek");
				case "month": return t("rangeMonth");
				case "all": return t("rangeAll");
			}
		}
		/**
		* Fixed widths for the numeric columns, shared by BOTH breakdown tables.
		*
		* They must be identical across the two tables. `table-layout: fixed` gives the
		* auto-width first column whatever is left, so two different width sums put the
		* numeric columns of the two tables at different x positions — the by-account
		* table's numbers sat 48px right of the by-model table's, which is what made a
		* long account row look like it was shoving the figures sideways. Sharing one
		* vector keeps every numeric column vertically aligned down the page.
		*
		* Last entry is wider because it carries the share bar (by model) as well as a
		* plain count (by account, "rotations").
		*/
		const NUM_COL_WIDTHS = [
			"48px",
			"56px",
			"56px",
			"56px",
			"64px"
		];
		/** One right-aligned numeric header cell at column position `index`. */
		function numHeader(index, label) {
			return h("th", {
				className: "agy-num",
				style: { width: NUM_COL_WIDTHS[index] }
			}, label);
		}
		/**
		* The Token composition bar rows: cache hits, input misses, output.
		*
		* A plain-prefix cache makes the cached share dominate (it re-reads the whole
		* prefix every turn), which is correct but reads as impossible without a
		* breakdown — hence this bar, which shows the proportion rather than restating
		* the numbers.
		*
		* The three rows must stay a PARTITION of `totalTokens` (they sum to 100%), so
		* the prompt side is split rather than labelled: `kpiCacheRead` (the hit count)
		* and `kpiInputMissed` (the rest). Using `kpiInput` for a row here would
		* double-count every cached token, because the headline input figure is now the
		* WHOLE prompt side — which already contains the hits. The split is what keeps
		* the bar honest and still adds up.
		*
		* `labelKey` and `id` are SEPARATE fields on purpose. A single `key` field used
		* for both the i18n lookup and React's `key` prop is how the label position ended
		* up rendering the raw dictionary key (`kpiCacheRead`) to every user: the value
		* served React correctly, so nothing failed, and the same variable was then
		* handed to the label span. Two names make that mix-up impossible.
		*/
		function tokenComposition(counters, t) {
			const total = totalTokens(counters);
			return h("div", { className: "agy-compose" }, ...[
				{
					id: "cacheRead",
					labelKey: "kpiCacheRead",
					value: counters.cacheRead,
					tone: aliasVar("brand-primary")
				},
				{
					id: "missed",
					labelKey: "kpiInputMissedLabel",
					value: counters.input,
					tone: "var(--dsw-static-neutral-bluish-700, #8b8f96)"
				},
				{
					id: "output",
					labelKey: "kpiOutput",
					value: counters.output,
					tone: aliasVar("state-success-primary")
				}
			].map((row) => {
				const share = total > 0 ? row.value / total * 100 : 0;
				return h("div", {
					className: "agy-compose-row",
					key: row.id
				}, h("span", { className: "agy-compose-k" }, t(row.labelKey)), h("span", { className: "agy-compose-track" }, h("i", { style: {
					width: `${Math.max(share, row.value > 0 ? 1 : 0)}%`,
					background: row.tone
				} })), h("span", { className: "agy-compose-v" }, tokenText(row.value)), h("span", { className: "agy-compose-p" }, `${share.toFixed(1)}%`));
			}));
		}
		function UsageTab(props) {
			const { t } = props;
			const [range, setRange] = (0, react.useState)("today");
			const stats = props.stats;
			if (stats === null) return h("div", { className: "agy-empty" }, t("loading"));
			if (stats.all.counters.requests === 0) return card(t("usageTitle"), h("div", { className: "agy-empty" }, t("emptyUsage")));
			const view = range === "today" ? stats.today : range === "week" ? stats.week : range === "month" ? stats.month : stats.all;
			const counters = view.counters;
			const hit = cacheHitPercent(counters);
			const total = totalTokens(counters);
			return h("div", { className: "agy-root" }, h("div", { className: "agy-toolbar" }, h("div", { className: "agy-chips" }, ...RANGE_IDS.map((id) => h(_deepseek_ai_dsh_client_ui_primitives.Pill, {
				key: id,
				active: range === id,
				onClick: () => {
					setRange(id);
				}
			}, rangeLabel(id, t)))), h("span", { className: "agy-grow" }), stats.since === null ? null : h("span", { className: "agy-aside" }, t("since", { date: new Date(stats.since).toLocaleDateString(props.lang) }))), card(t("usageTitle"), h("div", null, metrics([
				metric(t("kpiTotalTokens"), total, t("kpiTotalDetail", {
					requests: counters.requests,
					failed: counters.failed
				})),
				metric(t("kpiInput"), promptTokens(counters), t("kpiInputMissed", { tokens: tokenText(counters.input) })),
				metric(t("kpiCacheRead"), counters.cacheRead, hit === null ? t("kpiNoBilledInput") : t("kpiCacheHit", { percent: hit })),
				metric(t("kpiOutput"), counters.output, t("kpiOutputDetail"))
			]), tokenComposition(counters, t))), card(t("fieldLatency"), defs([
				[t("fieldCacheWrite"), tokenText(counters.cacheWrite)],
				[t("fieldRateLimitRotation"), `${counters.rateLimited} / ${counters.rotations}`],
				[t("labelLatencyAverage"), formatDuration(average(counters.latencyMs, counters.latencyN))],
				[t("labelTtft"), formatDuration(average(counters.ttftMs, counters.ttftN))]
			])), card(t("trendTitle"), h("div", { className: "agy-table-wrap" }, table(h("tr", null, h("th", null, t("colDay")), numHeader(0, t("colRequests")), numHeader(1, t("colFailed")), numHeader(2, t("colRateLimited")), numHeader(3, t("colRotations"))), stats.days.map((row) => h("tr", { key: row.day }, h("td", null, dayLabel(row.day, props.lang)), h("td", { className: "agy-num" }, String(row.requests)), h("td", { className: "agy-num" }, String(row.failed)), h("td", { className: "agy-num" }, String(row.rateLimited)), h("td", { className: "agy-num" }, String(row.rotations))))))), view.models.length === 0 ? null : card(t("byModel"), h("div", { className: "agy-table-wrap" }, table(h("tr", null, h("th", null, t("colModel")), numHeader(0, t("colRequests")), numHeader(1, t("kpiInput")), numHeader(2, t("kpiCacheRead")), numHeader(3, t("colOutput")), numHeader(4, t("colTokenShare"))), view.models.map((row) => h("tr", { key: row.model }, h("td", { className: "agy-strong" }, h("span", { className: "agy-mail" }, row.model)), h("td", { className: "agy-num" }, String(row.counters.requests)), h("td", { className: "agy-num" }, tokenText(promptTokens(row.counters))), h("td", { className: "agy-num" }, tokenText(row.counters.cacheRead)), h("td", { className: "agy-num" }, tokenText(row.counters.output)), h("td", { className: "agy-num" }, h("span", { className: "agy-bar" }, h("span", { className: "agy-track" }, h("i", { style: { width: `${Math.round(totalTokens(row.counters) / Math.max(1, total) * 100)}%` } }))))))))), view.accounts.length === 0 ? null : card(t("byAccount"), h("div", { className: "agy-table-wrap" }, table(h("tr", null, h("th", null, t("colAccount")), numHeader(0, t("colRequests")), numHeader(1, t("colToken")), numHeader(2, t("colFailed")), numHeader(3, t("colRateLimited")), numHeader(4, t("colRotations"))), view.accounts.map((row) => h("tr", { key: row.account }, h("td", { className: "agy-strong" }, h("span", { className: "agy-mail" }, row.account)), h("td", { className: "agy-num" }, String(row.counters.requests)), h("td", { className: "agy-num" }, tokenText(totalTokens(row.counters))), h("td", { className: "agy-num" }, String(row.counters.failed)), h("td", { className: "agy-num" }, String(row.counters.rateLimited)), h("td", { className: "agy-num" }, String(row.counters.rotations))))))));
		}
		function CredentialsTab(props) {
			const { t } = props;
			const [text, setText] = (0, react.useState)("");
			const sources = (0, react.useMemo)(() => text.split("\n").map((line) => line.trim()).filter((line) => line !== ""), [text]);
			const suffix = sources.length > 1 ? ` (${sources.length})` : "";
			return h("div", { className: "agy-root" }, subhead(t("importTitle")), hint(t("importHelp")), h("textarea", {
				className: "agy-textarea",
				style: { marginTop: "8px" },
				value: text,
				placeholder: t("importPlaceholder"),
				onChange: (event) => {
					setText(event.target.value);
				}
			}), h("div", {
				className: "agy-toolbar",
				style: { marginTop: "8px" }
			}, button(`${t("importJson")}${suffix}`, () => {
				props.onImport("json", sources);
			}, { disabled: props.busy || sources.length === 0 }), button(`${t("importBlob")}${suffix}`, () => {
				props.onImport("blob", sources);
			}, { disabled: props.busy || sources.length === 0 }), h("span", { className: "agy-grow" }), button(t("exportAll"), () => {
				props.onExportAll();
			}, { disabled: props.busy })));
		}
		/** The Settings section body. */
		function AgySettings(props) {
			const { rpc, t } = props;
			const [detailedQuotaReset, setDetailedQuotaReset] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				installAgyStyles();
				rpc.call("ui.prefs.get", {}).then((prefs) => {
					if (alive.current && prefs) setDetailedQuotaReset(prefs.detailedQuotaReset === true);
				}).catch(() => {});
			}, [rpc]);
			const [tab, setTab] = (0, react.useState)("accounts");
			const [accounts, setAccounts] = (0, react.useState)([]);
			const [models, setModels] = (0, react.useState)([]);
			const [modelAccount, setModelAccount] = (0, react.useState)(null);
			/** Model-discovery failure, shown on the Models tab only (see loadModels). */
			const [modelError, setModelError] = (0, react.useState)(void 0);
			/** Model ids whose own visibility write is in flight (see the toggle handler). */
			const [toggling, setToggling] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			/** Model ids whose own test call is in flight (see the per-row test button). */
			const [modelTesting, setModelTesting] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [stats, setStats] = (0, react.useState)(null);
			/**
			* Accounts with upstream requests in flight, from the polled `pool.status`.
			*
			* A poll, not a push: the section has no push channel, and the call is a pure
			* in-memory read on the host. A failed poll is display-only and stays silent —
			* the previous frame (including "idle") holds until the next tick, which is
			* the honest degradation for a status line.
			*/
			const [poolBusy, setPoolBusy] = (0, react.useState)([]);
			const [error, setError] = (0, react.useState)(void 0);
			/** A non-fatal outcome worth reporting (e.g. a partial credential import). */
			const [notice, setNoticeState] = (0, react.useState)(void 0);
			/**
			* The outcome of a one-shot action, timed like `notice`.
			*
			* A SEPARATE channel from `error` on purpose. `error` is also where a failed
			* `refresh()` lands, and "the account list could not be loaded" is a standing
			* condition: auto-dismissing it would leave a broken page looking fine 3.5s
			* later. Only an action's own verdict is transient, because the user already
			* knows what they clicked and the screen returns to a valid state either way.
			*/
			const [actionError, setActionErrorState] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [loaded, setLoaded] = (0, react.useState)(false);
			/** Guards state updates after the section unmounts mid-request. */
			const alive = (0, react.useRef)(true);
			/**
			* Show a transient message, then clear it.
			*
			* A message that never clears is indistinguishable from a stuck UI: the model
			* test's "X is working." stayed on screen forever, through every later action.
			* The deleted dashboard's toasts auto-dismissed after 3.5s for the same
			* reason; this keeps that behaviour, and a newer message simply replaces the
			* pending timer.
			*
			* One factory rather than two near-identical setters: the timer bookkeeping is
			* the part that must not drift between the success and failure channels. It
			* takes the timer ref as an argument rather than creating one, because a
			* `useCallback(timedChannel(...))` argument is evaluated on EVERY render — the
			* discarded function would still have appended its timer to the cancel list.
			* @param timer - the ref owning this channel's pending dismissal.
			* @param set - the state setter this channel writes to.
			* @returns a setter that arms the dismissal timer.
			*/
			const timedChannel = (timer, set) => (text) => {
				if (timer.current !== void 0) clearTimeout(timer.current);
				timer.current = void 0;
				set(text);
				if (text === void 0) return;
				timer.current = setTimeout(() => {
					timer.current = void 0;
					if (alive.current) set(void 0);
				}, ACTION_MESSAGE_TTL_MS);
			};
			/** Pending dismissal timers, one per channel, cancelled together on unmount. */
			const noticeTimer = (0, react.useRef)(void 0);
			const actionErrorTimer = (0, react.useRef)(void 0);
			const setNotice = (0, react.useCallback)(timedChannel(noticeTimer, setNoticeState), []);
			const setActionError = (0, react.useCallback)(timedChannel(actionErrorTimer, setActionErrorState), []);
			(0, react.useEffect)(() => () => {
				if (noticeTimer.current !== void 0) clearTimeout(noticeTimer.current);
				if (actionErrorTimer.current !== void 0) clearTimeout(actionErrorTimer.current);
			}, []);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
				};
			}, []);
			const refresh = (0, react.useCallback)(async () => {
				const [accountOutcome, statsOutcome] = await Promise.allSettled([rpc.call("account.list", {}), rpc.call("stats.get", {})]);
				if (!alive.current) return;
				if (accountOutcome.status === "fulfilled") setAccounts(accountOutcome.value.accounts);
				if (statsOutcome.status === "fulfilled") setStats(statsOutcome.value);
				const failed = [accountOutcome, statsOutcome].find((outcome) => outcome.status === "rejected");
				if (failed?.status === "rejected") {
					const caught = failed.reason;
					setError(caught instanceof Error ? caught.message : String(caught));
				} else setError(void 0);
				if (alive.current) setLoaded(true);
			}, [rpc]);
			/**
			* Refresh the 5h/weekly windows and merge them into the account rows.
			*
			* A separate call from `account.list` because that reply is deliberately
			* probe-free — folding an upstream call into it once made the whole view wait
			* on the network. Here the rows render immediately from `account.list` and the
			* windows fill in when they arrive, so a slow probe costs a placeholder.
			*
			* It also works for a pool of ANY size: the scheduling quota refresh is skipped
			* for a single enabled account (measuring that one could block the only
			* account), so this endpoint is the only thing that fills `cachedLimits` there.
			*
			* @param force - re-probe inside the TTL. Only an EXPLICIT refresh does this;
			*   an automatic one must respect the TTL, or every action that reloads the
			*   page would spend an upstream quota call.
			* @param report - whether to surface the outcome. Set only when the user asked
			*   for the refresh, since an automatic one must stay silent.
			*/
			const loadLimits = (0, react.useCallback)(async (force = false, report = false) => {
				try {
					const result = await rpc.call("account.limits", force ? { force: true } : {});
					if (!alive.current) return;
					const byIndex = new Map(result.limits.map((entry) => [entry.index, entry]));
					setAccounts((current) => current.map((account) => {
						const entry = byIndex.get(account.index);
						if (entry === void 0 || entry.groups === null) return account;
						return {
							...account,
							limits: entry.groups,
							limitsUpdatedAt: entry.updatedAt,
							limitBurn: entry.burn ?? account.limitBurn
						};
					}));
					if (report) {
						if (result.failed > 0) setActionError(t("limitsRefreshFailed", { failed: result.failed }));
						else if (result.measured > 0) setNotice(t("limitsRefreshOk", { measured: result.measured }));
						else setNotice(t("limitsRefreshFresh"));
					}
				} catch (caught) {
					if (report) setActionError(caught instanceof Error ? caught.message : String(caught));
				}
			}, [
				rpc,
				setActionError,
				setNotice,
				t
			]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				const tick = () => {
					if (document.hidden) return;
					rpc.call("pool.status", {}).then((result) => {
						if (alive.current) setPoolBusy(result.busy);
					}).catch(() => {});
				};
				tick();
				const timer = setInterval(tick, POOL_POLL_INTERVAL_MS);
				return () => {
					clearInterval(timer);
				};
			}, [rpc]);
			(0, react.useEffect)(() => {
				if (tab === "accounts" && accounts.length > 0) loadLimits();
			}, [
				tab,
				accounts.length,
				loadLimits
			]);
			/**
			* The toolbar's Refresh: reload the page AND force the quota windows.
			*
			* The force is the whole point of a manual refresh — without it the click
			* could not deliver anything newer than what the 10-minute TTL already holds,
			* so "I want the latest numbers now" was unanswerable. The two halves are
			* deliberately not awaited together: `refresh()` is the fast local reload,
			* while the forced probe can take seconds, and the rows should not wait on it.
			*/
			const refreshAll = (0, react.useCallback)(() => {
				refresh();
				if (tab === "accounts") loadLimits(true, true);
			}, [
				loadLimits,
				refresh,
				tab
			]);
			/**
			* The model list loads separately: it is the one call that may reach upstream
			* (model discovery), so the page must render even when it is slow or fails.
			*
			* Its failure is kept out of the shared error banner. The list is loaded
			* eagerly (the tab badge needs it), and "no account configured yet" is a
			* perfectly ordinary startup state for an accounts-first page — putting that
			* in the banner would greet every new user with an error.
			*/
			const loadModels = (0, react.useCallback)(async () => {
				try {
					const result = await rpc.call("model.list", {});
					if (!alive.current) return;
					setModels(result.models);
					setModelAccount(result.account);
					setModelError(void 0);
				} catch (caught) {
					if (!alive.current) return;
					setModelError(caught instanceof Error ? caught.message : String(caught));
				}
			}, [rpc]);
			(0, react.useEffect)(() => {
				loadModels();
			}, [loadModels]);
			(0, react.useEffect)(() => {
				if (tab === "models" && models.length === 0) loadModels();
			}, [
				tab,
				models.length,
				loadModels
			]);
			/** Run one mutating call, then reload; failures land in the banner. */
			const act = (0, react.useCallback)(async (run) => {
				setBusy(true);
				setNotice(void 0);
				try {
					await run();
					await refresh();
					setError(void 0);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : String(caught));
				} finally {
					if (alive.current) setBusy(false);
				}
			}, [refresh]);
			const startLogin = (0, react.useCallback)(() => {
				setBusy(true);
				rpc.call("auth.url", {}).then((result) => {
					window.open(result.url, "agy-oauth", "width=520,height=680");
					setError(void 0);
				}).catch((caught) => {
					setError(caught instanceof Error ? caught.message : String(caught));
				}).finally(() => {
					if (alive.current) setBusy(false);
				});
			}, [rpc]);
			(0, react.useEffect)(() => {
				const onMessage = (event) => {
					if (event.origin !== window.location.origin) return;
					if (event.data?.type === "agy_login_success") refresh();
				};
				window.addEventListener("message", onMessage);
				return () => {
					window.removeEventListener("message", onMessage);
				};
			}, [refresh]);
			const copyText = (0, react.useCallback)(async (text) => {
				await navigator.clipboard?.writeText(text);
			}, []);
			/**
			* Run one one-shot action under the shared busy / clear / report envelope.
			*
			* Deliberately NOT `act()`. `act()` reads only a REJECTION and then calls
			* `refresh()`, which clears the banner — so a handler whose failure arrives
			* IN BAND (`{ ok: false }`, which is how `account.verify`, `account.test` and
			* `account.proxyTest` all report) had its verdict both discarded and erased:
			* the click fired, the host answered, and the panel showed nothing. The
			* reload is also not always wanted; each caller decides.
			*
			* A thrown error still lands here, so a request-level failure (a rejected
			* promise, e.g. "no proxy configured") reports through the same channel.
			* @param run - the action, which reports its own in-band verdict.
			*/
			const runAction = (0, react.useCallback)(async (run) => {
				setBusy(true);
				setNotice(void 0);
				setActionError(void 0);
				try {
					await run();
				} catch (caught) {
					if (alive.current) setActionError(caught instanceof Error ? caught.message : String(caught));
				} finally {
					if (alive.current) setBusy(false);
				}
			}, [setActionError, setNotice]);
			const handlers = (0, react.useMemo)(() => ({
				t,
				onActivate: (index) => {
					act(() => rpc.call("account.activate", { index }));
				},
				onVerify: (index) => {
					runAction(async () => {
						const result = await rpc.call("account.verify", { index });
						if (alive.current) await refresh();
						if (!alive.current) return;
						if (result.ok) setNotice(t("verifyOk", { email: result.email ?? `#${index}` }));
						else setActionError(t("verifyFail") + (result.error === void 0 ? "" : `\n${result.error}`));
					});
				},
				onDelete: (index) => {
					if (!window.confirm(t("confirmDelete"))) return;
					act(() => rpc.call("account.delete", { index }));
				},
				onTest: (index) => {
					runAction(async () => {
						const target = (models.length > 0 ? models : (await rpc.call("model.list", {})).models).find((entry) => !entry.disabled)?.id;
						if (target === void 0) throw new Error(t("noModelToTest"));
						const result = await rpc.call("account.test", {
							model: target,
							index
						});
						if (alive.current) await refresh();
						if (!alive.current) return;
						if (result.ok) setNotice(t("modelTestOk", { model: target }));
						else setActionError(t("modelTestFail", { model: target }) + (result.error === void 0 ? "" : `\n${result.error}`));
					});
				},
				onExport: (index) => {
					act(async () => {
						const result = await rpc.call("account.export", { index });
						if (result.blob === void 0) throw new Error(result.error ?? t("exportFailed"));
						await copyText(result.blob);
					});
				},
				onRegenerateFingerprint: (index) => {
					act(() => rpc.call("account.fingerprint", {
						index,
						action: "regenerate"
					}));
				},
				onSetProxy: (index, proxy) => {
					act(() => rpc.call("account.proxy", {
						index,
						proxy
					}));
				},
				/**
				* Probe the proxy and REPORT the verdict.
				*
				* `account.proxyTest` answers in band (`{ ok, masked, error? }`) and only
				* throws for a request-level failure, so the in-band verdict is read here
				* rather than left to `act()`. No `refresh()`: the probe mutates no account
				* state, so reloading would be a second `account.list` + `stats.get` round
				* trip bought for nothing.
				*/
				onTestProxy: (index, proxy) => {
					runAction(async () => {
						const result = await rpc.call("account.proxyTest", {
							index,
							...proxy === "" ? {} : { proxy }
						});
						if (!alive.current) return;
						if (result.ok) setNotice(t("proxyTestOk", { proxy: result.masked }));
						else setActionError(t("proxyTestFail", { proxy: result.masked }) + (result.error === void 0 ? "" : `\n${result.error}`));
					});
				}
			}), [
				act,
				copyText,
				models,
				refresh,
				rpc,
				runAction,
				setActionError,
				setNotice,
				t
			]);
			const tabButton = (id, label, count) => h("button", {
				key: id,
				type: "button",
				className: "agy-tab",
				"data-active": tab === id,
				onClick: () => {
					setTab(id);
				}
			}, label, count === void 0 ? null : h("span", { className: "agy-count" }, String(count)));
			const body = tab === "accounts" ? h(AccountsTab, {
				accounts,
				busy,
				busyNow: poolBusy,
				handlers,
				lang: props.lang,
				rpc,
				t,
				detailedQuotaReset,
				onBadgePrefChange: props.onBadgePrefChange,
				onDetailedPrefChange: (enabled) => {
					setDetailedQuotaReset(enabled);
				}
			}) : tab === "models" ? modelError === void 0 ? h(ModelsTab, {
				models,
				account: modelAccount,
				pending: toggling,
				testing: modelTesting,
				t,
				/**
				* Optimistic, per-model toggle.
				*
				* The old handler ran the write AND a full `model.list` reload through
				* `act()`, so a click cost two network round trips (the reload reaches
				* upstream model discovery) while a single global `busy` flag disabled
				* every control on the page — hence "it hangs, everything is disabled,
				* then it switches". The write is authoritative and its result is
				* already known, so the list is updated from the response and no
				* reload is needed: the switch reflects exactly what the host stored.
				*/
				onToggle: (modelId, disabled) => {
					setToggling((current) => new Set(current).add(modelId));
					(async () => {
						try {
							const result = await rpc.call("model.setDisabled", {
								modelId,
								disabled
							});
							if (!alive.current) return;
							setModels((current) => current.map((model) => model.id === result.modelId ? {
								...model,
								disabled: result.disabled
							} : model));
							setError(void 0);
						} catch (caught) {
							if (!alive.current) return;
							setError(caught instanceof Error ? caught.message : String(caught));
						} finally {
							if (alive.current) setToggling((current) => {
								const next = new Set(current);
								next.delete(modelId);
								return next;
							});
						}
					})();
				},
				/**
				* One billed test call against exactly this model, reported in the
				* shared notice line (OK) or error banner (failure). The result must
				* not be silent: a test that shows nothing looks like nothing ran.
				*/
				onTestModel: (modelId) => {
					setError(void 0);
					setNotice(void 0);
					setModelTesting((current) => new Set(current).add(modelId));
					(async () => {
						try {
							const result = await rpc.call("account.test", { model: modelId });
							if (!alive.current) return;
							if (result.ok) setNotice(t("modelTestOk", { model: modelId }));
							else setError(t("modelTestFail", { model: modelId }) + (result.error ? `\n${result.error}` : ""));
						} catch (caught) {
							if (!alive.current) return;
							setError(caught instanceof Error ? caught.message : String(caught));
						} finally {
							if (alive.current) setModelTesting((current) => {
								const next = new Set(current);
								next.delete(modelId);
								return next;
							});
						}
					})();
				}
			}) : h("div", { className: "agy-root" }, h("div", { className: "agy-error" }, modelError), button(t("refresh"), () => {
				loadModels();
			}, { size: "sm" })) : tab === "config" ? h(ConfigTab, {
				rpc,
				t
			}) : tab === "usage" ? h(UsageTab, {
				stats,
				lang: props.lang,
				t
			}) : h(CredentialsTab, {
				busy,
				t,
				onImport: (kind, sources) => {
					act(async () => {
						const result = await rpc.call("account.import", {
							kind,
							sources
						});
						if (result.errors.length > 0) setNotice(`${t("importPartial", {
							imported: result.imported,
							replaced: result.replaced,
							failed: result.errors.length
						})}\n${result.errors.join("\n")}`);
						else setNotice(t("importResult", {
							imported: result.imported,
							replaced: result.replaced
						}));
					});
				},
				onExportAll: () => {
					act(async () => {
						const { blobs } = await rpc.call("account.exportAll", {});
						await copyText(blobs.map((entry) => entry.blob).join("\n"));
					});
				}
			});
			return h("div", { className: "agy-root" }, h("div", { className: "agy-head" }, h("div", null, h("div", { className: "agy-title" }, "Antigravity"), h("div", { className: "agy-sub" }, t("subtitle"))), h("div", { className: "agy-toolbar" }, button(t("refresh"), refreshAll, {
				size: "sm",
				disabled: busy
			}), button(t("login"), startLogin, {
				size: "sm",
				disabled: busy
			}))), h("div", { className: "agy-tabs" }, tabButton("accounts", t("tabAccounts"), accounts.length), tabButton("models", t("tabModels"), models.length > 0 ? models.length : void 0), tabButton("config", t("tabConfig")), tabButton("usage", t("tabUsage")), tabButton("credentials", t("tabCredentials"))), error === void 0 ? null : h("div", { className: "agy-error" }, error), actionError === void 0 ? null : h("div", { className: "agy-error" }, actionError), notice === void 0 ? null : h("div", { className: "agy-notice" }, notice), body, loaded || error !== void 0 ? null : h("div", { className: "agy-empty" }, t("loading")));
		}
		/**
		* Register the Antigravity Settings section while this client plugin is active.
		* @param ctx - Client Cordis context.
		*/
		function apply(ctx) {
			ctx.effect(() => installAgyStyles(), "dsh-agy: styles");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-agy: dictionaries");
			const connection = ctx.get("connection");
			if (connection === void 0) {
				ctx.logger.warn("[dsh-agy] connection service unavailable — Antigravity settings not registered");
				return;
			}
			const rpc = createRpc(connection);
			const t = ctx.locale.bind(NS);
			const lang = ctx.locale.getLocale?.().active;
			let badgeDisposer = null;
			const registerBadge = () => {
				if (badgeDisposer !== null) return;
				badgeDisposer = ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
					name: "conversation.session.header.actions",
					id: "agy-quota-badge",
					order: 8,
					label: () => t("title")
				}, () => h(AgyQuotaBadge, {
					rpc,
					t
				})));
			};
			const unregisterBadge = () => {
				if (badgeDisposer !== null) {
					badgeDisposer();
					badgeDisposer = null;
				}
			};
			rpc.call("ui.prefs.get", {}).then((prefs) => {
				if (prefs?.conversationBadge) registerBadge();
			}).catch(() => {});
			const onBadgePrefChange = (enabled) => {
				if (enabled) registerBadge();
				else unregisterBadge();
			};
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "agy",
				order: 30,
				locale: NS,
				label: () => t("title")
			}, () => h(AgySettings, {
				rpc,
				t,
				lang,
				onBadgePrefChange
			}))), "dsh-agy: Settings section");
			ctx.effect(() => () => {
				unregisterBadge();
			}, "dsh-agy: quota badge cleanup");
		}
		//#endregion
		exports.AgySettings = AgySettings;
		exports.apply = apply;
		exports.canActivateAccount = canActivateAccount;
		exports.inject = inject;
		exports.orderModels = orderModels;
		exports.resolveSelectedAccountIndex = resolveSelectedAccountIndex;
		exports.throughputTokenPerSecond = throughputTokenPerSecond;
		exports.tokenText = tokenText;
		exports.truncateIdentity = truncateIdentity;
		return module.exports;
	}
});
