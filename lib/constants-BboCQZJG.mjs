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
	antigravityUserAgent: () => antigravityUserAgent,
	currentAgyVersion: () => currentAgyVersion,
	fetchAgyFirstOk: () => fetchAgyFirstOk,
	getAgyBootstrapUserAgent: () => getAgyBootstrapUserAgent,
	resolveAgyClientCredentials: () => resolveAgyClientCredentials,
	setResolvedAgyVersion: () => setResolvedAgyVersion
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
* NAMESPACE: this is the **Antigravity CLI** line (`google-antigravity/antigravity-cli`),
* not the IDE or hub line, because that is the product this client claims to be
* (`docs/official-identity.json`). The three lines are separate version
* namespaces — IDE `2.0.0`, hub `2.15.1`, CLI `1.2.9` — so comparing them
* numerically is meaningless and mixing them advertises a version that does not
* exist for the product we name.
*/
const AGY_VERSION_FALLBACK = "2.28.2";
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
	return resolvedAgyVersion ?? "2.28.2";
}
/** Electron-style UA used for bootstrap calls (loadCodeAssist/onboardUser). */
function getAgyBootstrapUserAgent(version = currentAgyVersion()) {
	return `antigravity/hub/${version} (aidev_client; os_type=darwin; arch=arm64; cl=${AGY_HUB_CHANGELIST})`;
}
/**
* Short-form client User-Agent: `antigravity/<version> <platform>`.
*
* Used where the full Electron string would be inappropriate but the request
* must still not self-identify as this tool (e.g. the version feeds, which the
* official client ecosystem also polls).
*/
function antigravityUserAgent(version = currentAgyVersion(), platform = "darwin/arm64") {
	const [osType = "darwin", arch = "arm64"] = platform.split("/");
	return `antigravity/hub/${version} (aidev_client; os_type=${osType}; arch=${arch}; cl=${AGY_HUB_CHANGELIST})`;
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
export { isProxyRouted as S, resolveAgyClientCredentials as _, AGY_IDE_TYPE as a, AgyPoolBlockedError as b, AGY_VERSION_FALLBACK as c, OAUTH_USERINFO_URL as d, antigravityUserAgent as f, getAgyBootstrapUserAgent as g, fetchAgyFirstOk as h, AGY_HUB_CHANGELIST as i, OAUTH_AUTHORIZE_URL as l, currentAgyVersion as m, AGY_DEFAULT_REDIRECT_URI as n, AGY_PLATFORM_ENUM as o, constants_exports as p, AGY_ENDPOINT_FALLBACKS as r, AGY_SCOPES as s, AGY_CLIENT_ID as t, OAUTH_TOKEN_URL as u, setResolvedAgyVersion as v, QUOTA_WINDOWS as x, AgyAuthError as y };

//# sourceMappingURL=constants-BboCQZJG.mjs.map