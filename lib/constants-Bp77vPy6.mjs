import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { o as proxiedFetch } from "./proxy-B7VnbAfO.mjs";
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
/** Whether a request ran through an explicit per-account proxy. */
function isProxyRouted(routing) {
	return Boolean(routing?.proxyUrl);
}
/**
* Host-independent authentication error. The adapter maps `kind` to the DSH
* error protocol without coupling the session or CLI layers to dsh-llm.
*/
var AgyAuthError = class extends Error {
	kind;
	constructor(kind, message, options) {
		super(message, options);
		this.name = "AgyAuthError";
		this.kind = kind;
	}
};
/**
* Enabled accounts exist, but every candidate is temporarily blocked. Kept
* independent of dsh-llm so CLI and web entry points do not gain a host import.
*/
var AgyPoolBlockedError = class extends Error {
	kind;
	blockedUntil;
	constructor(kind, blockedUntil) {
		super(kind === "quota-exhausted" ? "All agy accounts have exhausted quota for the requested model family." : "All agy accounts are temporarily blocked for the requested model family.");
		this.name = "AgyPoolBlockedError";
		this.kind = kind;
		this.blockedUntil = blockedUntil;
	}
};
//#endregion
//#region src/ua-profile-types.ts
/**
* The lowest hub-line version measured to still be served.
*
* Measured 2026-11-09 on one account, one model, one prompt, one session id
* per probe, repeating each version to rule out flake:
*
*   2.0.0 ok · 2.1.0 retired · 2.2.0 retired · 2.3.0 ok · 2.4.0 retired
*   2.5.0 retired · 2.6.0 ok · 2.7.0 ok · 2.8.0 ok · 2.9.0 ok · 2.10.0 ok
*   2.15.0 ok · 2.20.0 ok · 2.25.0 ok · 2.29.0 ok · 3.0.0 ok
*
* The non-monotonic middle (2.0.0 and 2.3.0 served, 2.1/2.2/2.4/2.5 retired)
* is upstream's own gate, not a measurement error — every retired version
* reproduced three times. It means "pick a low version" is NOT safe advice: a
* version is served or not individually. The rule this constant encodes is
* only the practical floor, and the resolver plus the shipped default keep the
* profile far above it.
*/
const HUB_VERSION_FLOOR = "2.6.0";
/**
* A version to advertise when the hub feed cannot be read.
*
* Deliberately EQUAL to `AGY_VERSION_FALLBACK` in `oauth/constants.ts`: the
* HUB profile and the hub feed are the SAME line, so two constants naming
* different releases of one product is a drift with no upside. That module is
* the single source of truth (the freshness gate compares it against the live
* feed); this one exists only so `ua-profile-types.ts` can name a floor without
* importing the OAuth constants, which would pull `node:*` into the browser half.
*
* The value tracks the LIVE FEED (2.29.0), not the version installed on any one
* machine: this constant ships to every user, so advertising a build that the
* release feed does not publish would name a client that may not exist for them
* — the installed artifact can legitimately be ahead (a local build) or behind
* (a machine that has not updated). A unit test pins it equal to
* `AGY_VERSION_FALLBACK`, so the duplication cannot rot.
*/
const HUB_VERSION_FALLBACK = "2.31.2";
/** Message a custom template must contain to receive the version. */
const UA_TEMPLATE_VERSION_TOKEN = "{version}";
/** Message a custom template may contain to receive the platform token. */
const UA_TEMPLATE_PLATFORM_TOKEN = "{platform}";
/**
* Whether a template may be stored.
*
* A template with no `{version}` would freeze a literal version into the file,
* which is exactly the silent staleness the version resolver exists to prevent
* — and it would drift from `clientMetadata.ideVersion` in the same request.
* So the version placeholder is REQUIRED; the platform one is optional.
*/
function isValidUaTemplate(template) {
	return typeof template === "string" && template.length > 0 && template.length <= 512 && !/[\u0000-\u001f\u007f]/.test(template) && template.includes("{version}");
}
//#endregion
//#region src/oauth/constants.ts
/**
* Antigravity (agy) OAuth and API constants.
*
* The client id/secret below are the public Google consumer-OAuth credentials
* shipped inside the Antigravity desktop product and its `agy` CLI; they are
* embedded in many public tools (see NOTICE.md). They are not secrets owned by
* this project.
*/
var constants_exports = /* @__PURE__ */ __exportAll({
	AGY_CLIENT_ID: () => AGY_CLIENT_ID,
	AGY_CLIENT_SECRET: () => AGY_CLIENT_SECRET,
	AGY_CLI_VERSION_FALLBACK: () => AGY_CLI_VERSION_FALLBACK,
	AGY_DEFAULT_REDIRECT_URI: () => AGY_DEFAULT_REDIRECT_URI,
	AGY_ENDPOINT_AUTOPUSH: () => AGY_ENDPOINT_AUTOPUSH,
	AGY_ENDPOINT_DAILY: () => AGY_ENDPOINT_DAILY,
	AGY_ENDPOINT_DAILY_SANDBOX: () => AGY_ENDPOINT_DAILY_SANDBOX,
	AGY_ENDPOINT_FALLBACKS: () => AGY_ENDPOINT_FALLBACKS,
	AGY_ENDPOINT_PROD: () => AGY_ENDPOINT_PROD,
	AGY_ENDPOINT_SKIP_STATUSES: () => AGY_ENDPOINT_SKIP_STATUSES,
	AGY_HUB_CHANGELIST: () => AGY_HUB_CHANGELIST,
	AGY_IDE_TYPE: () => AGY_IDE_TYPE,
	AGY_PLATFORM_ENUM: () => AGY_PLATFORM_ENUM,
	AGY_SCOPES: () => AGY_SCOPES,
	AGY_VERSION_FALLBACK: () => AGY_VERSION_FALLBACK,
	OAUTH_AUTHORIZE_URL: () => OAUTH_AUTHORIZE_URL,
	OAUTH_TOKEN_URL: () => OAUTH_TOKEN_URL,
	OAUTH_USERINFO_URL: () => OAUTH_USERINFO_URL,
	agyCliUserAgent: () => agyCliUserAgent,
	agyHubUserAgent: () => agyHubUserAgent,
	antigravityUserAgent: () => antigravityUserAgent,
	currentAgyVersion: () => currentAgyVersion,
	currentCliVersion: () => currentCliVersion,
	currentHubVersion: () => currentHubVersion,
	fetchAgyFirstOk: () => fetchAgyFirstOk,
	resolveAgyClientCredentials: () => resolveAgyClientCredentials,
	setProfileUserAgentRenderer: () => setProfileUserAgentRenderer,
	setResolvedAgyVersion: () => setResolvedAgyVersion,
	setResolvedCliVersion: () => setResolvedCliVersion,
	setResolvedHubVersion: () => setResolvedHubVersion
});
const AGY_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const AGY_CLIENT_SECRET = "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";
/**
* Effective OAuth client credentials: AGY_CLIENT_ID / AGY_CLIENT_SECRET env
* overrides win when set (BYO OAuth app escape hatch, mirrors pi-antigravity);
* otherwise the embedded public Antigravity credentials are used.
*/
function resolveAgyClientCredentials(overrideClientId) {
	if (overrideClientId) {
		if (overrideClientId === "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com") return {
			clientId: AGY_CLIENT_ID,
			clientSecret: AGY_CLIENT_SECRET
		};
		return {
			clientId: overrideClientId,
			clientSecret: process.env.AGY_CLIENT_SECRET || "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"
		};
	}
	return {
		clientId: process.env.AGY_CLIENT_ID || "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
		clientSecret: process.env.AGY_CLIENT_SECRET || "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"
	};
}
/** Required scopes. `openid` must NOT be added: it routes Google into the hanging
* `firstparty/nativeapp` consent for this client (verified by OmniRoute). */
const AGY_SCOPES = [
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
	"https://www.googleapis.com/auth/cclog",
	"https://www.googleapis.com/auth/experimentsandconfigs"
];
const OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo";
/** Default loopback callback used by the standalone CLI listener (fixed port, like opencode). */
const AGY_DEFAULT_REDIRECT_URI = "http://localhost:51121/oauth-callback";
/**
* Antigravity API endpoints. The daily runtime host (no .sandbox suffix) is the
* live endpoint for consumer OAuth accounts — cloudcode-pa.googleapis.com
* answers RESOURCE_EXHAUSTED for them (verified by live probe), while the
* daily host answers 200. Order matters: first reachable non-429/403/503 wins.
*/
const AGY_ENDPOINT_DAILY = "https://daily-cloudcode-pa.googleapis.com";
const AGY_ENDPOINT_PROD = "https://cloudcode-pa.googleapis.com";
const AGY_ENDPOINT_DAILY_SANDBOX = "https://daily-cloudcode-pa.sandbox.googleapis.com";
const AGY_ENDPOINT_AUTOPUSH = "https://autopush-cloudcode-pa.sandbox.googleapis.com";
/** Runtime/bootstrap endpoint fallback order (daily first, mirroring OmniRoute). */
const AGY_ENDPOINT_FALLBACKS = [
	AGY_ENDPOINT_DAILY,
	AGY_ENDPOINT_PROD,
	AGY_ENDPOINT_DAILY_SANDBOX,
	AGY_ENDPOINT_AUTOPUSH
];
/**
* Statuses that mean "this endpoint is not usable for this attempt"; skip to the
* next one in the chain. 429/403 = rate/quota/entitlement wall, 503 = capacity
* rejection (e.g. "No capacity available for model ..."). A 503 skipped here
* still reaches the caller when every endpoint fails, where the classifier marks
* it transient and the adapter surfaces it as a retryable SERVER error.
*/
const AGY_ENDPOINT_SKIP_STATUSES = /* @__PURE__ */ new Set([
	429,
	403,
	503
]);
/**
* Try each runtime endpoint in order, skipping unusable ones (429/403/503/network).
* Returns the first other response (2xx or a real error like 400/401); when
* every endpoint is unusable, returns the last skipped response so the caller's
* classifier can still produce a meaningful error (a returned 503 becomes a
* retryable SERVER failure rather than being swallowed here).
*
* When every endpoint fails at the network level, the LAST error is rethrown so
* its cause survives (a generic "all endpoints failed" hid DNS/TLS/timeout).
*/
async function fetchAgyFirstOk(urlPath, init, fetchImpl = proxiedFetch, options = {}) {
	let lastSkipped = null;
	let lastNetworkError;
	for (const baseEndpoint of AGY_ENDPOINT_FALLBACKS) try {
		const response = await fetchImpl(`${baseEndpoint}${urlPath}`, init);
		if (!AGY_ENDPOINT_SKIP_STATUSES.has(response.status)) return response;
		if (!lastSkipped || baseEndpoint !== "https://autopush-cloudcode-pa.sandbox.googleapis.com" && (response.status === 429 || response.status === 503)) lastSkipped = response;
	} catch (error) {
		lastNetworkError = error;
		if (isProxyRouted(options)) {
			const { isProxyUnreachableError } = await import("./proxy-B7VnbAfO.mjs").then((n) => n.c);
			if (isProxyUnreachableError(error)) throw error;
		}
	}
	if (lastSkipped) return lastSkipped;
	if (lastNetworkError !== void 0) throw lastNetworkError;
	throw new Error("all agy endpoints failed");
}
/**
* Pinned Antigravity version, used only until the runtime resolver has published
* a fresh one (see {@link setResolvedAgyVersion}).
*
* A stale version string is the most detectable fingerprint anomaly, so this
* value is a cold-start floor, not the version anything should normally send.
* It tracks the release feed's newest entry; refresh it when the feed moves.
*
* NAMESPACE: this is the **hub** line, the product this client presents
* as by default (`src/ua-profile.ts`, `docs/official-identity.json`). The three
* Antigravity lines are separate version namespaces — IDE `2.x`/`1.2x`, hub
* `2.2x`, CLI `1.5.x` — so comparing them numerically is meaningless, and mixing
* them advertises a version that does not exist for the product named.
*
* A version from the WRONG line is not merely stale: measured 2026-11-09, an
* `antigravity/hub/` string carrying `1.5.3` is answered with the "no longer
* supported" notice on generation AND returns only ONE quota group. The CLI line
* has its own slot ({@link currentAgyVersion} is the hub slot; the CLI profile
* reads the CLI feed through `ua-profile.ts`).
*/
const AGY_VERSION_FALLBACK = "2.31.2";
const AGY_HUB_CHANGELIST = "1003475615";
/**
* `ClientMetadata.platform` value: the proto enum NAME, as protobuf-JSON emits it.
*
* The official enumeration is `PLATFORM_UNSPECIFIED | DARWIN_AMD64 | DARWIN_ARM64
* | LINUX_AMD64 | LINUX_ARM64 | WINDOWS_AMD64` (read from the installed official
* CLI's own descriptor). The earlier `"MACOS"` that this backend rejected with
* `INVALID_ARGUMENT` was an invalid *value*, not a forbidden field — a
* distinction that mattered, because it had been read as "send `ideType` only".
*/
const AGY_PLATFORM_ENUM = "DARWIN_ARM64";
/**
* Newest Antigravity version the runtime resolver has observed, or undefined
* before its first success.
*
* Deliberately lives in this module — the dependency leaf — rather than in
* `runtime/version.ts`. `oauth/` must not import `runtime/` (AGENTS.md), and the
* edge already runs the other way: `runtime/version.ts` imports THIS file. So the
* resolver publishes here and every User-Agent builder reads here.
*
* This shape is the fix for a real defect: the version used to be a function
* parameter, and all six bootstrap call sites silently took the default, pinning
* every control-plane request to the stale fallback while the data plane used the
* resolved version — one process presenting two different clients. Reading a
* shared value makes that drift unrepresentable rather than merely discouraged.
*/
let resolvedAgyVersion;
/** Publish a freshly resolved version for every User-Agent builder. */
function setResolvedAgyVersion(version) {
	resolvedAgyVersion = version;
}
/** Version a User-Agent should advertise: the resolved one, else the pinned floor. */
function currentAgyVersion() {
	return resolvedAgyVersion ?? "2.31.2";
}
/**
* The hub desktop app's User-Agent: `antigravity/hub/<ver> (<tokens>)`.
*
* The SHAPE and the `cl=` token are upstream's, not invented here: the installed
* app spawns its language server with `--override_user_agent_name antigravity
* --subclient_type hub --override_ide_version <app version>`, the binary's own
* diagnostic format is `%s/%s (%s)`, and the parenthesized vocabulary
* (`aidev_client`, `os_type=`, `arch=`, `cl=`) is its string blob.
*
* MEASURED 2026-11-09 on one account, one model, one prompt, one session id per
* probe, each version repeated three times, varying only the version inside this
* shape:
*
*   2.6.0 / 2.7.0 / 2.8.0 / 2.9.0 / 2.10.0 / 2.15.0 / 2.20.0 / 2.25.0 /
*   2.28.2 / 2.29.0 / 3.0.0        -> 200 + finishReason, quota 2 groups
*   2.1.0 / 2.2.0 / 2.4.0 / 2.5.0  -> 200 + retirement notice, quota 1 group
*   1.5.3 (the CLI line)           -> 200 + retirement notice, quota 1 group
*
* Two consequences that are easy to get wrong: the gate is PER-VERSION and not
* monotonic (2.0.0 and 2.3.0 are served while 2.1/2.2/2.4/2.5 are not), and the
* version LINE matters beyond servability — a `1.x` value inside this shape also
* drops the `Gemini Models` quota group.
*/
function agyHubUserAgent(version = currentHubVersion(), platform = "darwin/arm64") {
	const [rawOs = "darwin", arch = "arm64"] = platform.split("/");
	return `antigravity/hub/${version} (aidev_client; os_type=${rawOs === "darwin" ? "macos" : rawOs}; arch=${arch}; cl=${AGY_HUB_CHANGELIST})`;
}
/**
* Newest hub-app version the runtime resolver has observed.
*
* A SEPARATE slot from {@link resolvedAgyVersion} would be redundant here — this
* module has ONE hub slot now — but it is kept as a distinct NAME so callers read
* intent rather than a bare variable, and so the CLI line can never be published
* into it by accident (see `ua-profile.ts`).
*/
let resolvedHubVersion;
/** Publish a freshly resolved hub version for the hub UA builder. */
function setResolvedHubVersion(version) {
	resolvedHubVersion = version;
	resolvedAgyVersion = version;
}
/**
* Newest version the runtime resolver has observed on the **CLI** feed.
*
* A THIRD slot, and it is not redundant: the hub manifest and the CLI releases
* are different products with disjoint numbering, and both are live at once
* (`resolveObservedAgyVersion` reads the hub first, `resolveAntigravityCliVersion`
* the CLI). Without this, `currentAgyVersion()` — the hub slot — became the CLI
* profile's version too, so selecting the CLI profile emitted
* `antigravity/cli/<hub version>`: a hub number inside a CLI shape, exactly the
* line mismatch that retires the request.
*/
let resolvedCliVersion;
/** Publish a freshly resolved CLI-line version. */
function setResolvedCliVersion(version) {
	resolvedCliVersion = version;
}
/**
* Cold-start floor for the **CLI** line.
*
* A SEPARATE constant from {@link AGY_VERSION_FALLBACK} because that one is the
* HUB line's floor. Reusing it here made the CLI profile advertise
* `antigravity/cli/<hub version>` whenever its feed had not been read yet — a hub
* number inside a CLI shape, i.e. precisely the mismatch that retires the request
* and drops the Gemini quota group. This value tracks the LIVE CLI release feed
* (what ships to every user), not whatever `agy --version` reports on one
* machine, and `pnpm run verify:version-freshness` checks it against that feed
* on every run.
*/
const AGY_CLI_VERSION_FALLBACK = "1.5.7";
/** Version the CLI UA should advertise: the observed CLI one, else its own floor. */
function currentCliVersion() {
	return resolvedCliVersion ?? "1.5.7";
}
/** Version the hub UA should advertise: the observed one, else the floor. */
function currentHubVersion() {
	return resolvedHubVersion ?? resolvedAgyVersion ?? "2.31.2";
}
/** Called by `ua-profile.ts` to bind the active-profile renderer. */
function setProfileUserAgentRenderer(renderer) {}
/**
* The CLI's own User-Agent: `antigravity/cli/<version> (<tokens>)`.
*
* MEASURED (2026-11-08, live `streamGenerateContent` against both daily and
* prod, alternating the shape on ONE account at one version so only the shape
* varied):
*
*   antigravity/cli/1.5.2 ...  -> 200, a real answer
*   antigravity/1.5.2 darwin/arm64 -> 200, "This version of Antigravity is no
*                                     longer supported. ..." as ordinary text
*
* That short form is the data-plane gate: the backend accepts it as a client but
* refuses to serve it, and the refusal is an HTTP-200 plain-text notice carrying
* NO `finishReason` — so `parse.ts`'s completeness guard reports it as "stream
* terminated prematurely". `os_type`/`arch` are unvalidated (measured); the shape
* is what matters.
*/
function agyCliUserAgent(version = currentCliVersion(), platform = "darwin/arm64") {
	const [rawOs = "darwin", arch = "arm64"] = platform.split("/");
	return `antigravity/cli/${version} (aidev_client; os_type=${rawOs === "darwin" ? "macos" : rawOs}; arch=${arch}; auth_method=consumer)`;
}
/**
* The client User-Agent, as the version feeds and non-generation probes send it.
*
* A THIN ALIAS of {@link agyHubUserAgent}, not a second template: the hub
* shape is the only non-CLI shape this client emits, and keeping two copies of
* that template is how the two drift into different `cl=` values or platform
* spellings. Callers that want the CLI shape ask {@link agyCliUserAgent}.
*/
function antigravityUserAgent(version = currentAgyVersion(), platform = "darwin/arm64") {
	return agyHubUserAgent(version, platform);
}
/**
* `ClientMetadata.ideType` value.
*
* `ANTIGRAVITY` is retained rather than switched to the enumeration's newer
* `GEMINI_CLI`: the CLI's own `IdeType` is injected through its auth provider and
* has not been captured, so the established working value is kept and the
* alternative recorded (`docs/official-identity.json`) rather than guessed at.
*/
const AGY_IDE_TYPE = "ANTIGRAVITY";
//#endregion
export { AgyPoolBlockedError as A, setResolvedHubVersion as C, UA_TEMPLATE_VERSION_TOKEN as D, UA_TEMPLATE_PLATFORM_TOKEN as E, isProxyRouted as M, isValidUaTemplate as O, setResolvedCliVersion as S, HUB_VERSION_FLOOR as T, currentHubVersion as _, AGY_PLATFORM_ENUM as a, setProfileUserAgentRenderer as b, OAUTH_AUTHORIZE_URL as c, agyCliUserAgent as d, agyHubUserAgent as f, currentCliVersion as g, currentAgyVersion as h, AGY_IDE_TYPE as i, QUOTA_WINDOWS as j, AgyAuthError as k, OAUTH_TOKEN_URL as l, constants_exports as m, AGY_DEFAULT_REDIRECT_URI as n, AGY_SCOPES as o, antigravityUserAgent as p, AGY_ENDPOINT_FALLBACKS as r, AGY_VERSION_FALLBACK as s, AGY_CLIENT_ID as t, OAUTH_USERINFO_URL as u, fetchAgyFirstOk as v, HUB_VERSION_FALLBACK as w, setResolvedAgyVersion as x, resolveAgyClientCredentials as y };

//# sourceMappingURL=constants-Bp77vPy6.mjs.map