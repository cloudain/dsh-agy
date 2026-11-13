import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { EnvHttpProxyAgent, ProxyAgent } from "undici";
import { createConnection } from "node:net";
//#region src/redact.ts
/**
* Credential redaction for text that may reach logs, the GUI, or a terminal.
*
* A leaf module on purpose: `runtime/classify.ts` and `proxy.ts` both need it,
* and `classify.ts` already imports `proxy.ts`, so importing redaction from
* either one into the other would close an import cycle.
*/
/**
* Strip proxy credentials from URL-like text so `user:pass` never reaches logs
* or the GUI. Splits at the LAST `@` of the authority, which is the real
* userinfo delimiter (RFC 3986: a host cannot contain a raw `@`), so a password
* that itself contains `@` is redacted whole rather than truncated at the first
* one — the failure mode of the character-class regex this replaced.
*
* Two passes, because a rejected proxy URL is exactly the input that does not
* parse: the first handles `scheme://user:pass@host`, the second catches a
* scheme-less `user:pass@host` that {@link import('./proxy.ts').normalizeProxyUrl}
* rejects before ever building a `URL`. Both split at the LAST `@`, so a password
* containing `@` is redacted whole in either shape (truncating at the first `@`
* left the password's tail in the message). The second requires a `:` inside the
* userinfo, so a bare address (`someone@example.com`) is left alone.
*
* Over-redaction is the intended bias: an error message losing a detail costs
* nothing, while an unredacted one can put a live proxy password in a screenshot.
*/
function redactCredentials(text) {
	return text.replace(/([a-z][a-z0-9+.-]*:\/\/)([^\s/?#]+)/gi, (match, scheme, authority) => {
		const at = authority.lastIndexOf("@");
		if (at === -1) return match;
		return `${scheme}<REDACTED>@${authority.slice(at + 1)}`;
	}).replace(/(^|[\s(]|\/\/)([^\s/@:]+:(?!\/\/)[^\s]*)@/g, (_match, lead) => `${lead}<REDACTED>@`);
}
//#endregion
//#region src/proxy.ts
/**
* Proxy-aware fetch: per-account proxy (http/https/socks5) + env fallback.
* - account.proxy present => per-account dispatcher (fail-closed, not affected by NO_PROXY)
* - otherwise => EnvHttpProxyAgent (honours HTTP_PROXY/HTTPS_PROXY/NO_PROXY)
* Applied per-request via dispatcher option so the host's global dispatcher stays untouched.
*/
var proxy_exports = /* @__PURE__ */ __exportAll({
	_envAgentForTest: () => envAgent,
	accountFetch: () => accountFetch,
	dispatcherForAsync: () => dispatcherForAsync,
	dispatcherOptsFor: () => dispatcherOptsFor,
	isProxyReachable: () => isProxyReachable,
	isProxyUnreachableError: () => isProxyUnreachableError,
	normalizeProxyUrl: () => normalizeProxyUrl,
	probeFetch: () => probeFetch,
	proxiedFetch: () => proxiedFetch,
	proxyUrlForLogs: () => proxyUrlForLogs,
	tagProxyUnreachable: () => tagProxyUnreachable
});
const envAgent = new EnvHttpProxyAgent();
/**
* Streaming variant of the env agent. A generation stream may legitimately stay
* silent for minutes mid-turn (reasoning), and undici's `bodyTimeout` is a
* per-gap inactivity timer — the 30s control-plane value kills such a turn.
* Only generation uses this agent; every other call keeps the short bound.
*/
const envStreamingAgent = new EnvHttpProxyAgent({ bodyTimeout: 0 });
const dispatcherCache = /* @__PURE__ */ new Map();
const SUPPORTED = /* @__PURE__ */ new Set([
	"http:",
	"https:",
	"socks5:",
	"socks5h:"
]);
function defaultPort(protocol) {
	if (protocol === "https:") return "443";
	if (protocol === "socks5:" || protocol === "socks5h:") return "1080";
	return "8080";
}
function normalizeProxyUrl(proxyUrl) {
	let raw = proxyUrl.trim();
	if (!raw) throw new Error("[proxy] empty proxy URL");
	if (raw.toLowerCase().startsWith("socks://")) raw = "socks5://" + raw.slice(8);
	const familyMatch = raw.match(/\?family=(ipv4|ipv6)$/);
	const familySuffix = familyMatch ? familyMatch[0] : "";
	const baseRaw = familySuffix ? raw.slice(0, -familySuffix.length) : raw;
	let parsed;
	try {
		parsed = new URL(baseRaw);
	} catch {
		throw new Error(`[proxy] invalid proxy URL: ${proxyUrlForLogs(proxyUrl)}`);
	}
	let protocol = parsed.protocol.toLowerCase();
	if (protocol === "socks5h:") protocol = "socks5:";
	if (!SUPPORTED.has(protocol) && protocol !== "socks5:") {
		if (!SUPPORTED.has(parsed.protocol.toLowerCase())) throw new Error(`[proxy] unsupported protocol: ${parsed.protocol}`);
	}
	if (![
		"http:",
		"https:",
		"socks5:"
	].includes(protocol)) throw new Error(`[proxy] unsupported protocol: ${parsed.protocol}`);
	if (!parsed.hostname) throw new Error("[proxy] missing host");
	let port = parsed.port;
	if (!port) port = defaultPort(protocol);
	const portNum = Number(port);
	if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) throw new Error("[proxy] invalid port");
	const auth = parsed.username ? `${encodeURIComponent(decodeURIComponent(parsed.username))}${parsed.password ? `:${encodeURIComponent(decodeURIComponent(parsed.password))}` : ""}@` : "";
	const normalizedBase = `${protocol}//${auth}${parsed.hostname}:${port}`;
	return familySuffix ? `${normalizedBase}${familySuffix}` : normalizedBase;
}
function proxyUrlForLogs(proxyUrl) {
	try {
		const fam = proxyUrl.match(/\?family=(ipv4|ipv6)$/);
		const base = fam ? proxyUrl.slice(0, -fam[0].length) : proxyUrl;
		const u = new URL(base);
		if (!u.hostname) return redactCredentials(proxyUrl);
		const port = u.port || defaultPort(u.protocol);
		return `${u.protocol}//${u.hostname}:${port}`;
	} catch {
		return redactCredentials(proxyUrl);
	}
}
const PROXY_UNREACHABLE_CODES = /* @__PURE__ */ new Set([
	"ECONNREFUSED",
	"ECONNRESET",
	"ETIMEDOUT",
	"ENETUNREACH",
	"EHOSTUNREACH",
	"EPIPE",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_SOCKET"
]);
function isLoopbackUrl(url) {
	try {
		const h = (typeof url === "string" ? new URL(url) : url).hostname.toLowerCase();
		return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "::ffff:127.0.0.1";
	} catch {
		return false;
	}
}
function isProxyUnreachableError(err) {
	const seen = /* @__PURE__ */ new Set();
	let cur = err;
	for (let depth = 0; cur && depth < 5 && !seen.has(cur); depth++) {
		seen.add(cur);
		if (cur && typeof cur === "object") {
			const code = cur.code;
			if (typeof code === "string" && PROXY_UNREACHABLE_CODES.has(code)) return true;
			const errorCode = cur.errorCode;
			if (errorCode === "proxy_unreachable" || errorCode === "PROXY_UNREACHABLE") return true;
			if (cur.statusCode === 503) {
				const m = cur.message;
				if (typeof m === "string" && m.includes("Proxy unreachable")) return true;
			}
			const msg = cur.message;
			if (typeof msg === "string") {
				if (msg.includes("proxy_unreachable") || msg.includes("PROXY_UNREACHABLE")) return true;
				for (const c of PROXY_UNREACHABLE_CODES) if (msg.includes(c)) return true;
			}
		}
		cur = cur?.cause;
		if (!cur && err?.errors && depth === 0) {
			const errs = err.errors;
			if (Array.isArray(errs)) {
				for (const e of errs) if (isProxyUnreachableError(e)) return true;
			}
		}
	}
	return false;
}
function tagProxyUnreachable(err) {
	if (isProxyUnreachableError(err)) {
		const e = err;
		e.code = "PROXY_UNREACHABLE";
		e.errorCode = "proxy_unreachable";
	}
	return err;
}
const FAST_FAIL_TIMEOUT_MS = 2e3;
const HEALTHY_TTL_MS = 3e4;
const UNHEALTHY_TTL_MS = 2e3;
const healthCache = /* @__PURE__ */ new Map();
const healthInflight = /* @__PURE__ */ new Map();
function tcpCheck(host, port, timeoutMs) {
	return new Promise((resolve) => {
		const socket = createConnection({
			host,
			port
		}, () => {
			socket.destroy();
			resolve(true);
		});
		socket.setTimeout(timeoutMs);
		socket.on("error", () => resolve(false));
		socket.on("timeout", () => {
			socket.destroy();
			resolve(false);
		});
	});
}
async function isProxyReachable(proxyUrl, timeoutMs = FAST_FAIL_TIMEOUT_MS) {
	const key = normalizeProxyUrl(proxyUrl);
	const cached = healthCache.get(key);
	if (cached && Date.now() - cached.at < cached.ttl) return cached.healthy;
	const existing = healthInflight.get(key);
	if (existing) return existing;
	let url;
	try {
		const base = key.replace(/\?family=(ipv4|ipv6)$/, "");
		url = new URL(base);
	} catch {
		healthCache.set(key, {
			healthy: false,
			at: Date.now(),
			ttl: UNHEALTHY_TTL_MS
		});
		return false;
	}
	const probe = tcpCheck(url.hostname.replace(/^\[/, "").replace(/\]$/, ""), Number(url.port || defaultPort(url.protocol)), timeoutMs).then((healthy) => {
		healthCache.set(key, {
			healthy,
			at: Date.now(),
			ttl: healthy ? HEALTHY_TTL_MS : UNHEALTHY_TTL_MS
		});
		return healthy;
	});
	healthInflight.set(key, probe);
	try {
		return await probe;
	} finally {
		if (healthInflight.get(key) === probe) healthInflight.delete(key);
	}
}
/**
* Decoded proxy credentials. `URL.username`/`password` are the percent-ENCODED
* substrings, and undici decodes them only where it parses the URI itself: the
* HTTP tunnel path builds `proxy-authorization` from decoded values, but the
* SOCKS5 sub-path forwards `opts.username`/`opts.password` VERBATIM to the auth
* subnegotiation, so an encoded `p%40ss` would reach the proxy literally and be
* rejected. Decoding here is what makes both paths see the real credentials.
*/
function decodedProxyAuth(proxyUrl) {
	try {
		const u = new URL(proxyUrl);
		if (!u.username) return {};
		return {
			username: decodeURIComponent(u.username),
			...u.password ? { password: decodeURIComponent(u.password) } : {}
		};
	} catch {
		return {};
	}
}
function createHttpDispatcher(proxyUrl, dispatcherOpts) {
	const clean = proxyUrl.replace(/\?family=(ipv4|ipv6)$/, "");
	return new ProxyAgent({
		uri: clean,
		proxyTunnel: true,
		...decodedProxyAuth(clean),
		...dispatcherOpts
	});
}
/**
* Dispatcher options. `bodyTimeout` is undici's per-gap inactivity timer, not a
* total transfer budget: it fires when NO bytes arrive for that long. The
* control-plane calls want the short bound, but a generation stream may
* legitimately stay silent for minutes mid-turn (reasoning), so streaming runs
* with the timer disabled — the SSE read loop's own idle watchdog
* (`resolveStreamIdleTimeoutMs`, default `DEFAULT_STREAM_IDLE_TIMEOUT_MS`,
* `adapter/parse.ts`) bounds a stalled body instead, which this timer could not
* tell apart from reasoning anyway.
*
* `keepAliveTimeout`/`keepAliveMaxTimeout` deliberately stay at 1ms and are NOT
* loosened for streaming: undici applies them only when `pipelining` is
* non-zero, and `pipelining: 0` forces every connection to reset on completion,
* so they are inert here. They are kept at the conservative value spec #8 asks
* for rather than being replaced by a setting that would never take effect.
*
* SOCKS5 exception (measured against undici 7.29): the socks sub-path drops
* these options — the per-origin pool behind its Socks5ProxyAgent accepts only
* pipelining/connections/connect — so on a socks5:// proxy both call classes
* run at undici's defaults (~300s per-gap) and the streaming `bodyTimeout: 0`
* guarantee above does NOT hold. There is no option channel to change that.
*/
const DISPATCHER_OPTS = {
	headersTimeout: 3e4,
	bodyTimeout: 3e4,
	connectTimeout: 1e4,
	keepAliveTimeout: 1,
	keepAliveMaxTimeout: 1,
	pipelining: 0
};
/** Streaming dispatcher options: same bounds, minus the body inactivity timer. */
const STREAMING_DISPATCHER_OPTS = {
	...DISPATCHER_OPTS,
	bodyTimeout: 0
};
/** Resolved dispatcher options for a call class (exported as the source of truth). */
function dispatcherOptsFor(streaming) {
	return streaming ? STREAMING_DISPATCHER_OPTS : DISPATCHER_OPTS;
}
function dispatcherCacheKey(normalized, streaming) {
	return streaming ? `${normalized}|stream` : normalized;
}
async function dispatcherForAsync(proxyUrl, options = {}) {
	const streaming = options.streaming === true;
	if (!proxyUrl) return streaming ? envStreamingAgent : envAgent;
	const normalized = normalizeProxyUrl(proxyUrl);
	const key = dispatcherCacheKey(normalized, streaming);
	const cached = dispatcherCache.get(key);
	if (cached) return cached;
	const dispatcher = createHttpDispatcher(normalized, dispatcherOptsFor(streaming));
	dispatcherCache.set(key, dispatcher);
	return dispatcher;
}
function getTargetUrlString(input) {
	if (typeof input === "string") return input;
	try {
		if (input instanceof URL) return input.toString();
		if (typeof input.url === "string") return input.url;
	} catch {}
	return "";
}
/** fetch() that respects per-account proxyUrl (when given) otherwise env. */
const proxiedFetch = async (input, init, opts) => {
	const proxyUrl = opts?.proxyUrl ?? init?.proxyUrl;
	const streaming = opts?.streaming === true;
	const cleanInit = { ...init };
	if (cleanInit.proxyUrl) delete cleanInit.proxyUrl;
	if (!proxyUrl) return fetch(input, {
		...cleanInit,
		dispatcher: streaming ? envStreamingAgent : envAgent
	});
	const targetStr = getTargetUrlString(input);
	if (targetStr && isLoopbackUrl(targetStr)) return fetch(input, cleanInit);
	try {
		if (!await isProxyReachable(proxyUrl)) {
			const err = /* @__PURE__ */ new Error(`[Proxy Fast-Fail] Proxy unreachable: ${proxyUrlForLogs(proxyUrl)}`);
			err.code = "PROXY_UNREACHABLE";
			err.errorCode = "proxy_unreachable";
			err.statusCode = 503;
			throw err;
		}
	} catch (e) {
		if (e?.errorCode === "proxy_unreachable") throw e;
		if (e instanceof Error && e.message.startsWith("[proxy]")) throw e;
	}
	let dispatcher;
	try {
		dispatcher = await dispatcherForAsync(proxyUrl, { streaming });
	} catch (e) {
		throw tagProxyUnreachable(e);
	}
	try {
		return await fetch(input, {
			...cleanInit,
			dispatcher
		});
	} catch (err) {
		throw tagProxyUnreachable(err);
	}
};
/**
* Bind one account's routing to a fetch implementation.
*
* The single entry point every account-scoped call uses (generation, test call,
* model/quota discovery, project healing, import enrichment). Threading a bare
* `proxyUrl` at each site is what let six call sites drift and silently route a
* proxied account over the host's real IP, so the invariant is enforced here
* instead of by review (AGENTS.md "Proxy Routing").
*/
function accountFetch(routing) {
	return ((input, init) => proxiedFetch(input, init, {
		...routing?.proxyUrl ? { proxyUrl: routing.proxyUrl } : {},
		...routing?.streaming ? { streaming: true } : {}
	}));
}
/**
* Fetch for a POOL-LEVEL probe: a request that belongs to no single account
* (the Antigravity release feeds) but still egresses the host.
*
* `undefined` means the env/direct route, which is also where an unproxied
* account's traffic goes. Given a URL it routes there, so a per-account-proxy
* user does not leak the real IP on a boot-time or failure-path probe. Both
* probe sites (plugin boot, the rate-limit fingerprint path) go through here so
* the routing rule cannot drift between them.
*/
function probeFetch(proxyUrl) {
	return proxyUrl === void 0 || proxyUrl === "" ? proxiedFetch : accountFetch({ proxyUrl });
}
//#endregion
export { probeFetch as a, proxy_exports as c, normalizeProxyUrl as i, redactCredentials as l, isProxyReachable as n, proxiedFetch as o, isProxyUnreachableError as r, proxyUrlForLogs as s, accountFetch as t };

//# sourceMappingURL=proxy-B7VnbAfO.mjs.map