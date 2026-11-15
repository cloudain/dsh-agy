import { g as getAgyBootstrapUserAgent, r as AGY_ENDPOINT_FALLBACKS, x as QUOTA_WINDOWS } from "./constants-BboCQZJG.mjs";
import { o as proxiedFetch } from "./proxy-B7VnbAfO.mjs";
//#region src/adapter/quota-summary.ts
/**
* `v1internal:retrieveUserQuotaSummary` — the grouped 5-hour / weekly quota
* windows, as distinct from `fetchAvailableModels`' per-model `quotaInfo`.
*
* WHY THIS ENDPOINT EXISTS HERE AT ALL. `fetchAvailableModels` reports only
* `remainingFraction` + `resetTime` per model, with NO window field: measured
* across every id, the only keys under `quotaInfo` are those two. So a "5-hour
* vs weekly" view is not derivable from it, and the summary endpoint is the only
* source for both windows. Recorded in docs/ANTIGRAVITY-API.md §3, which
* previously stated the opposite ("no retrieveUserQuota path").
*
* The shapes differ meaningfully and must not be merged:
*   - `fetchAvailableModels` -> per MODEL (used for ranking/rotation)
*   - `retrieveUserQuotaSummary` -> per GROUP (Gemini, Claude+GPT), 2 windows each
* The group split is upstream's own, so it is carried through verbatim rather
* than re-derived from model-id prefixes: `3p-*` covers Claude AND GPT, which no
* prefix rule in `modelFamilyOf` would group together.
*
* Measured response (live account):
*   { groups: [ { displayName, buckets: [
*       { bucketId: "gemini-5h", window: "5h", remainingFraction, resetTime },
*       { bucketId: "gemini-weekly", window: "weekly", ... } ] } ] }
*
* The identity used is the same bootstrap User-Agent as `fetchAvailableModels`
* (that pair is what answers 200 here), so nothing new is impersonated.
*/
const QUOTA_SUMMARY_PATH = "/v1internal:retrieveUserQuotaSummary";
/**
* Sort rank for an upstream window token: shorter windows first.
*
* The order comes from `QUOTA_WINDOWS` (`types.ts`), the same table the scheduler
* reads its window kinds from, so the parser and the scheduler cannot drift
* apart — they used to keep separate tables, and the `daily` token only one of
* them knew about silently destroyed a real measurement. Unknown tokens rank last
* (and tie-break alphabetically) so a window added upstream later is still shown,
* just after the ones we understand.
*/
function windowRank(window) {
	return QUOTA_WINDOWS[window]?.rank ?? Number.MAX_SAFE_INTEGER;
}
/** Clamp to 0..1; a non-number is "unknown" rather than zero. */
function fractionOf(raw) {
	if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
	return Math.max(0, Math.min(1, raw));
}
/** A non-empty string, else null. */
function stringOf(raw) {
	return typeof raw === "string" && raw !== "" ? raw : null;
}
/**
* Parse a summary payload into groups.
*
* Defensive like the rest of the wire parsing: a group with no usable window is
* DROPPED rather than rendered as an empty card, because a group row with no
* windows tells the user nothing and would push a real group off screen. Buckets
* are ordered with the shorter window first so a group reads "immediate pressure,
* then the weekly budget" consistently regardless of upstream order.
*/
function parseQuotaSummary(raw) {
	const data = raw;
	if (typeof data !== "object" || data === null) return [];
	const groups = [];
	for (const group of Array.isArray(data.groups) ? data.groups : []) {
		if (typeof group !== "object" || group === null) continue;
		const windows = [];
		for (const bucket of Array.isArray(group.buckets) ? group.buckets : []) {
			if (typeof bucket !== "object" || bucket === null) continue;
			const bucketId = stringOf(bucket.bucketId);
			const window = stringOf(bucket.window);
			if (bucketId === null || window === null) continue;
			windows.push({
				bucketId,
				window,
				remainingFraction: fractionOf(bucket.remainingFraction),
				resetTime: stringOf(bucket.resetTime)
			});
		}
		if (windows.length === 0) continue;
		windows.sort((a, b) => windowRank(a.window) - windowRank(b.window) || a.window.localeCompare(b.window));
		groups.push({
			name: stringOf(group.displayName) ?? "",
			windows
		});
	}
	return groups;
}
/**
* Fetch and parse the grouped windows for one account.
*
* Mirrors `fetchAvailableModels`: the endpoint fallback chain is walked here, and
* the caller injects only the routed+time-bounded fetch, so the account's proxy
* is honoured (omitting it would go direct and leak the account's real IP) and
* one shared budget bounds both calls.
*
* @param accessToken - a live access token for the account.
* @param projectId - the account's Cloud Code project id, when known.
* @param fetchImpl - routed, time-bounded fetch implementation.
* @returns the parsed groups; empty when no endpoint answers (never throws, so a
*   summary failure cannot discard the ranking data fetched alongside it).
*/
async function fetchQuotaSummary(accessToken, projectId, fetchImpl = proxiedFetch) {
	const body = JSON.stringify(projectId ? { project: projectId } : {});
	for (const baseEndpoint of AGY_ENDPOINT_FALLBACKS) try {
		const response = await fetchImpl(`${baseEndpoint}${QUOTA_SUMMARY_PATH}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"User-Agent": getAgyBootstrapUserAgent()
			},
			body
		});
		if (!response.ok) continue;
		return parseQuotaSummary(await response.json());
	} catch {}
	return [];
}
//#endregion
export { fetchQuotaSummary };

//# sourceMappingURL=quota-summary-qOSOvtdc.mjs.map