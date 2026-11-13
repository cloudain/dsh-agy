import { S as isProxyRouted, _ as resolveAgyClientCredentials, b as AgyPoolBlockedError, f as antigravityUserAgent, i as AGY_HUB_CHANGELIST, m as currentAgyVersion, o as AGY_PLATFORM_ENUM, t as AGY_CLIENT_ID, u as OAUTH_TOKEN_URL, v as setResolvedAgyVersion, x as QUOTA_WINDOWS, y as AgyAuthError } from "./constants-BboCQZJG.mjs";
import { a as probeFetch, l as redactCredentials, o as proxiedFetch, r as isProxyUnreachableError, t as accountFetch } from "./proxy-B7VnbAfO.mjs";
import { i as generateAntigravityRequestId, r as deriveAntigravitySessionId } from "./identity-Ci8EGc1F.mjs";
import { i as parseRefreshParts, n as calculateTokenExpiry, r as formatRefreshParts, t as accessTokenExpired } from "./auth-DPPVFwio.mjs";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Document, isMap, isScalar, parseDocument } from "yaml";
import lockfile from "proper-lockfile";
//#region src/runtime/classify.ts
/**
* Upstream failure classification: HTTP status + headers + body → FailureKind.
* Conservative by design: only auth-failure may revoke an account; everything
* else cools, rotates, or retries.
*/
/**
* Phrases the upstream uses to ask for account verification rather than
* rejecting a credential. Matched case-insensitively on the raw body.
*
* Kept as a phrase list (not a bare `includes('verify')`) so an ordinary
* permission error is not mistaken for a recoverable challenge — the cost of a
* false positive is a healthy account parked behind a timed block.
*/
const VERIFICATION_PHRASES = [
	"validation_required",
	"verify your account",
	"verification required",
	"verification_required"
];
/** Whether a 403 body asks the account owner to verify rather than meaning dead credentials. */
function isVerificationRequired(bodyText) {
	if (!bodyText) return false;
	const text = bodyText.toLowerCase();
	return VERIFICATION_PHRASES.some((phrase) => text.includes(phrase));
}
/**
* Pull the appeal/verification link out of a Google RPC error body.
*
* Prefers the structured location — `error.details[].metadata.validation_url`,
* then `appeal_url` — and only falls back to the first bare `https://` match,
* because a loose match can pick up an unrelated link. Google escapes `&` as
* `\u0026` inside the JSON string form, so the fallback unescapes it.
*/
function extractVerificationUrl(bodyText) {
	if (!bodyText) return void 0;
	try {
		const details = JSON.parse(bodyText).error?.details;
		if (Array.isArray(details)) for (const detail of details) {
			const meta = detail?.metadata;
			if (!meta) continue;
			for (const field of ["validation_url", "appeal_url"]) {
				const value = meta[field];
				if (typeof value === "string" && value.length > 0) return value;
			}
		}
	} catch {}
	const unescaped = bodyText.replace(/\\u0026/gi, "&");
	const match = /https:\/\/[^\s"'\\]+/.exec(unescaped);
	return match ? match[0] : void 0;
}
const QUOTA_EXHAUSTED_KEYWORDS = [
	"quota_exhausted",
	"quota exhausted",
	"quota reached",
	"enable overages",
	"individual quota"
];
/** Classify a 429 body into the four upstream categories. */
function classifyRateLimit(bodyText, retryAfterMs) {
	const text = (bodyText ?? "").toLowerCase();
	if (QUOTA_EXHAUSTED_KEYWORDS.some((keyword) => text.includes(keyword))) return "quota_exhausted";
	if (retryAfterMs !== void 0 && retryAfterMs < 3e3) return "soft_rate_limit";
	if (retryAfterMs !== void 0) return "rate_limited";
	return text.includes("quota") || text.includes("resource_exhausted") ? "quota_exhausted" : "unknown";
}
const RATE_LIMIT_RESET_FIELDS = [
	"resetTime",
	"reset_time",
	"resetAt",
	"quotaResetTime"
];
function extractResetTime(bodyText) {
	if (!bodyText) return void 0;
	try {
		const data = JSON.parse(bodyText);
		for (const field of RATE_LIMIT_RESET_FIELDS) {
			const value = data[field];
			if (typeof value === "string" && value) return value;
			if (typeof value === "number" && Number.isFinite(value)) return value > 0xe8d4a51000 ? new Date(value).toISOString() : new Date(Date.now() + value * 1e3).toISOString();
		}
		const quotaInfo = data.quotaInfo;
		if (quotaInfo && typeof quotaInfo.resetTime === "string") return quotaInfo.resetTime;
	} catch {}
}
function parseRetryAfter(header) {
	if (!header) return void 0;
	const seconds = Number(header);
	if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1e3;
	const date = Date.parse(header);
	if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
}
/** Classify a completed HTTP response (non-2xx). */
function classifyHttpError(status, headers, bodyText) {
	const retryAfterMs = parseRetryAfter(headers.get("retry-after"));
	const resetTime = extractResetTime(bodyText);
	if (status === 429) return {
		kind: "rate-limit",
		rateLimitCategory: classifyRateLimit(bodyText, retryAfterMs),
		status,
		retryAfterMs,
		resetTime,
		message: bodyText ? bodyText.slice(0, 200) : void 0
	};
	if (status === 401) return {
		kind: "auth-failure",
		status,
		message: bodyText ? bodyText.slice(0, 200) : void 0
	};
	if (status === 403) {
		if (isVerificationRequired(bodyText)) return {
			kind: "verification-required",
			status,
			verificationUrl: extractVerificationUrl(bodyText),
			message: bodyText ? bodyText.slice(0, 200) : void 0
		};
		const category = classifyRateLimit(bodyText, void 0);
		if (category === "quota_exhausted") return {
			kind: "rate-limit",
			rateLimitCategory: category,
			status,
			message: bodyText ? bodyText.slice(0, 200) : void 0
		};
		if (bodyText && /^\s*<(!doctype|html)/i.test(bodyText)) return {
			kind: "transient",
			status,
			message: bodyText.slice(0, 200)
		};
		return {
			kind: "auth-failure",
			status,
			message: bodyText ? bodyText.slice(0, 200) : void 0
		};
	}
	if (status === 404) return {
		kind: "transient",
		status,
		message: bodyText ? bodyText.slice(0, 200) : void 0
	};
	if (status >= 500) return {
		kind: "transient",
		status,
		retryAfterMs,
		message: bodyText ? bodyText.slice(0, 200) : void 0
	};
	if (status === 400) {
		const text = (bodyText ?? "").toLowerCase();
		if (text.includes("context") && (text.includes("overflow") || text.includes("too long") || text.includes("exceeded")) || text.includes("model") && (text.includes("not found") || text.includes("unavailable") || text.includes("not supported"))) return {
			kind: "transient",
			status,
			message: bodyText ? bodyText.slice(0, 200) : void 0
		};
		return {
			kind: "request-error",
			status,
			message: bodyText ? bodyText.slice(0, 200) : void 0
		};
	}
	return {
		kind: "transient",
		status,
		message: bodyText ? bodyText.slice(0, 200) : void 0
	};
}
/**
* Phrases the upstream returns when a conversation's SERVER-SIDE accumulated
* input for one `sessionId` passes the 1M ceiling.
*
* This is not a request-construction error: the payload is fine, but the
* upstream session that `sessionId` names has accumulated too much across turns.
* The recovery is to derive a different `sessionId` (a "generation" bump) and
* resend — hence this predicate is checked before {@link classifyHttpError} so
* such a 400 is not collapsed into a terminal `request-error`.
*
* Matched on the measured upstream text; kept phrase-specific (rather than a
* bare `includes('tokens')`) so a genuine model-capability 400 is not mistaken
* for a bumpable session wall.
*/
const SESSION_ACCUMULATION_PHRASES = [
	"exceeds the maximum number of tokens",
	"input token count exceeds",
	"token count exceeds the maximum"
];
/**
* Whether a failed response is the recoverable per-`sessionId` accumulation
* wall rather than a malformed request.
*
* @param status - HTTP status of the failed response.
* @param bodyText - response body, when readable.
* @returns true when a session-generation bump plus one resend can recover.
*/
function isSessionAccumulationOverflow(status, bodyText) {
	if (status !== 400 || !bodyText) return false;
	const text = bodyText.toLowerCase();
	return SESSION_ACCUMULATION_PHRASES.some((phrase) => text.includes(phrase));
}
/** Codes that carry a socket/syscall `code` worth surfacing in a failure message. */
const TRANSPORT_CAUSE_CODES = /* @__PURE__ */ new Set([
	"ECONNREFUSED",
	"ECONNRESET",
	"ETIMEDOUT",
	"ENETUNREACH",
	"EHOSTUNREACH",
	"EPIPE",
	"ENOTFOUND",
	"EAI_AGAIN",
	"CERT_HAS_EXPIRED",
	"DEPTH_ZERO_SELF_SIGNED_CERT",
	"UNABLE_TO_VERIFY_LEAF_SIGNATURE",
	"ERR_TLS_CERT_ALTNAME_INVALID",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_SOCKET",
	"UND_ERR_HEADERS_TIMEOUT",
	"UND_ERR_BODY_TIMEOUT",
	"UND_ERR_ABORTED"
]);
/**
* Placeholder messages undici/Node emit while the real reason sits deeper in
* the cause chain; they must not shadow a usable code further down.
*/
const GENERIC_CAUSE_MESSAGES = /* @__PURE__ */ new Set([
	"fetch failed",
	"terminated",
	"other side closed",
	"aborted"
]);
/**
* Walk the error cause chain collecting the actionable `code` and message.
* Node/undici reports `TypeError: fetch failed` and stores the real reason in
* `error.cause` (verified against live failures): without this, DNS, TLS,
* timeout, reset, and proxy failures are indistinguishable in DSH session
* events and the GUI.
*/
function describeCause(error) {
	const seen = /* @__PURE__ */ new Set();
	let current = error?.cause ?? error;
	let fallbackMessage;
	for (let depth = 0; current && depth < 6 && !seen.has(current); depth++) {
		seen.add(current);
		if (typeof current === "object") {
			const code = current.code;
			const message = current.message;
			const usableMessage = typeof message === "string" && message.length > 0 ? message : void 0;
			if (typeof code === "string" && TRANSPORT_CAUSE_CODES.has(code)) return {
				code,
				message: usableMessage
			};
			if (usableMessage && !GENERIC_CAUSE_MESSAGES.has(usableMessage) && !fallbackMessage) fallbackMessage = usableMessage;
			const errors = current.errors;
			if (Array.isArray(errors)) for (const nested of errors) {
				const described = describeCause({ cause: nested });
				if (described.code) return described;
				if (described.message && !fallbackMessage) fallbackMessage = described.message;
			}
		}
		current = current?.cause;
	}
	return fallbackMessage ? { message: fallbackMessage } : {};
}
/**
* Human-readable transport failure: `fetch failed (UND_ERR_SOCKET: other side
* closed)`. The sanitized cause code/message is what makes a transient socket
* error distinguishable from a DNS, TLS, or proxy failure in session records.
*/
function describeFetchError(error) {
	const base = error instanceof Error ? error.message : String(error);
	const { code, message } = describeCause(error);
	if (!code && !message) return redactCredentials(base);
	const detail = code && message ? message.includes(code) ? message : `${code}: ${message}` : code ?? message;
	if (detail === base) return redactCredentials(base);
	return redactCredentials(`${base} (${detail})`);
}
/**
* Classify a fetch-level failure (DNS, refused, timeout, abort).
* @param routing - how the failed request was routed; fail-closed applies only
*   when it carried an explicit per-account proxy (see {@link AccountRouting}).
*/
function classifyFetchError(error, routing) {
	const message = describeFetchError(error);
	if (error instanceof DOMException && error.name === "AbortError") return {
		kind: "network-error",
		message
	};
	if (error?.errorCode === "proxy_unreachable" || error?.code === "PROXY_UNREACHABLE") return {
		kind: "proxy-unreachable",
		message
	};
	if (isProxyRouted(routing) && isProxyUnreachableError(error)) return {
		kind: "proxy-unreachable",
		message
	};
	return {
		kind: "network-error",
		message
	};
}
//#endregion
//#region src/store/keyring.ts
/**
* Master-key management and AES-256-GCM secret codec for the account store.
*
* The master key lives in the DSH credentials document (`~/.dsh/.credentials.yaml`,
* 0600) under `AGY_MASTER_KEY` so both the in-harness plugin (via
* `ctx.credentials`) and the standalone `dsh-agy` CLI (direct file read) can
* encrypt and decrypt the same account store.
*/
const MASTER_KEY_REF = "AGY_MASTER_KEY";
const ENC_PREFIX$1 = "enc:v1:";
/** AES-256-GCM codec; ciphertext format `enc:v1:<iv-b64>:<tag-b64>:<data-b64>`. */
function createAesGcmCodec(key) {
	if (key.length !== 32) throw new Error(`createAesGcmCodec: master key must be 32 bytes, got ${key.length}`);
	return {
		encrypt(plaintext) {
			const iv = randomBytes(12);
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
			const tag = cipher.getAuthTag();
			return `${ENC_PREFIX$1}${iv.toString("base64url")}:${tag.toString("base64url")}:${data.toString("base64url")}`;
		},
		decrypt(payload) {
			if (!payload.startsWith(ENC_PREFIX$1)) throw new Error("decrypt: payload is not in encrypted format");
			const [, , ivB64 = "", tagB64 = "", dataB64 = ""] = payload.split(":");
			const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
			decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
			return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
		}
	};
}
/** Derive a 32-byte key from an arbitrary master-key string (SHA-256). */
function deriveKey(masterKey) {
	return createHash("sha256").update(masterKey, "utf8").digest();
}
/** Default DSH home (`~/.dsh`), honoring `$DSH_HOME`. */
function resolveDshHome() {
	return process.env.DSH_HOME ? resolve(process.env.DSH_HOME) : join(homedir(), ".dsh");
}
function homedir() {
	return process.env.HOME ?? process.env.USERPROFILE ?? ".";
}
/** A credentials reference name must be a POSIX-style identifier. */
const REF_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** The document's non-reference sections. */
const SECTION_KEYS = ["version", "records"];
/** Every top-level key DSH's credentials provider admits; anything else is rejected. */
const DOCUMENT_TOP_LEVEL = /* @__PURE__ */ new Set([...SECTION_KEYS, "refs"]);
/**
* Describe one YAML parse failure without quoting the source, which holds
* secrets. The parser's own message embeds the offending line.
*/
function describeYamlError(error) {
	const at = error.linePos?.[0];
	return `${error.code ?? "parse-error"}${at ? ` at line ${at.line}, column ${at.col}` : ""}`;
}
/**
* Parse the credentials document and locate its `refs` section.
*
* The document is owned by DSH's credentials provider, which serializes it with
* the `yaml` package. Values are folded across physical lines (a long
* single-quoted scalar folds at whitespace) and `records` payloads nest
* arbitrary keys, so this MUST be a real parse rather than a line scan: a
* line-based reader cannot represent folding, and it lets a `records` payload
* shadow a real top-level reference.
*
* Deliberately permissive: it validates only the shape it consumes, so the read
* path keeps working on a document written by an older build. What may be
* rewritten is enforced separately, in the writer.
*/
function parseCredentialsDocument(text, file, context) {
	const document = parseDocument(text, {
		prettyErrors: true,
		uniqueKeys: true
	});
	if (document.errors.length > 0) throw new Error(`${context}: cannot parse ${file}: ` + document.errors.map(describeYamlError).join("; "));
	const root = document.contents;
	if (!isMap(root)) throw new Error(`${context}: ${file} must be a mapping`);
	const refs = root.get("refs");
	if (refs !== void 0 && refs !== null && !isMap(refs)) throw new Error(`${context}: "refs" in ${file} must be a mapping`);
	return {
		document,
		root,
		refs: isMap(refs) ? refs : void 0,
		flat: !root.has("version")
	};
}
/**
* Read the references from the DSH credentials document.
*
* Only `refs` holds references, and a `records` payload must never be able to
* shadow one. Two compatibility cases matter:
*
* - A pre-release "flat" document keeps its references at the top level; the
*   provider still reads that layout, so we do too.
* - Version 0.2.7 of this plugin appended the master key as a *top-level* key.
*   The provider rejects such a document, but the key still decrypts an
*   existing account store, so it is read as a fallback. Dropping it would
*   silently mint a new master key and strand those accounts.
*
* Non-string and empty values are skipped, mirroring the provider.
*/
function readCredentialsDocument(file) {
	const entries = /* @__PURE__ */ new Map();
	if (!existsSync(file)) return entries;
	const text = readFileSync(file, "utf8");
	if (text.trim().length === 0) return entries;
	const { root, refs, flat } = parseCredentialsDocument(text, file, "readCredentialsDocument");
	const section = flat ? root : refs;
	if (section) for (const item of section.items) {
		if (!isScalar(item.key) || !isScalar(item.value)) continue;
		const key = item.key.value;
		const value = item.value.value;
		if (typeof key !== "string" || !REF_NAME.test(key)) continue;
		if (flat && SECTION_KEYS.includes(key)) continue;
		if (typeof value !== "string" || value.length === 0) continue;
		entries.set(key, value);
	}
	if (!flat && !entries.has("AGY_MASTER_KEY")) {
		const legacy = root.get(MASTER_KEY_REF);
		if (typeof legacy === "string" && legacy.length > 0) entries.set(MASTER_KEY_REF, legacy);
	}
	return entries;
}
/**
* POSIX owner-only enforcement. Windows mode bits never report 0600 (and
* chmod is a no-op there), so the check is skipped on win32; the encrypted
* account file and credentials document remain the only defense-in-depth
* layer on that platform.
*/
function assertOwnerOnly(file) {
	if (process.platform === "win32") return;
	const mode = statSync(file).mode & 511;
	if (mode !== 384) throw new Error(`dsh-agy: ${file} is readable beyond its owner (mode ${mode.toString(8)}); run "chmod 600" before starting again`);
}
/**
* Load the master key from the DSH credentials document. Returns undefined when
* the document or the reference is absent.
*/
function loadMasterKey(dshHome) {
	const file = join(dshHome, ".credentials.yaml");
	if (!existsSync(file)) return void 0;
	assertOwnerOnly(file);
	return readCredentialsDocument(file).get(MASTER_KEY_REF);
}
/** Top-level keys DSH's credentials provider admits; anything else is rejected. */
/**
* Render the version-1 layout for a pre-release "flat" document — a non-empty
* top-level mapping of reference names to non-empty string scalars, with no
* `version` key and no document directives. The original lines are nested
* verbatim under `refs:`, so comments, blank lines, and each value's spelling
* survive byte for byte. Returns undefined for anything the recognizer
* declines, which the caller must then refuse to rewrite.
*
* Nesting whole lines is safe for block scalars: an explicit indent indicator
* (`|2`) is absolute and the implied one is detected relative to the key, so
* shifting every line by the same two spaces preserves the parsed value.
*/
function renderFlatLayoutMigration(text) {
	for (const line of text.split("\n")) if (/^(%|---|\.\.\.)/.test(line)) return void 0;
	const document = parseDocument(text, {
		prettyErrors: true,
		uniqueKeys: true
	});
	if (document.errors.length > 0) return void 0;
	const flat = document.contents;
	if (!isMap(flat) || flat.items.length === 0) return void 0;
	for (const pair of flat.items) {
		if (!isScalar(pair.key) || typeof pair.key.value !== "string") return void 0;
		if (DOCUMENT_TOP_LEVEL.has(pair.key.value) || !REF_NAME.test(pair.key.value)) return void 0;
		if (!isScalar(pair.value) || typeof pair.value.value !== "string") return void 0;
		if (pair.value.value.length === 0) return void 0;
	}
	return `version: 1\nrefs:\n${text.split("\n").map((line) => line.length === 0 ? line : `  ${line}`).join("\n")}${text.endsWith("\n") ? "" : "\n"}`;
}
/**
* Render the credentials document with {@link MASTER_KEY_REF} added under `refs`.
*
* The key MUST be nested under `refs`: DSH's credentials provider rejects any
* other top-level key, and a document it rejects makes *every* credential in
* the file unreadable, not just ours. Editing the parsed document keeps the
* comments and formatting of every untouched entry; a document this build
* cannot prove it understands is never rewritten.
*/
function renderWithMasterKey(existingText, masterKey, file) {
	const fresh = () => new Document({
		version: 1,
		refs: { [MASTER_KEY_REF]: masterKey }
	}).toString();
	if (existingText.trim().length === 0) return fresh();
	const { document, root, refs, flat } = parseCredentialsDocument(existingText, file, "persistMasterKey");
	if (flat) {
		const migrated = renderFlatLayoutMigration(existingText);
		if (migrated === void 0) throw new Error(`persistMasterKey: ${file} is not a credentials document this build can prove it understands; refusing to rewrite it`);
		const next = parseDocument(migrated);
		next.setIn(["refs", MASTER_KEY_REF], masterKey);
		return next.toString();
	}
	for (const key of root.items) {
		if (!isScalar(key.key) || typeof key.key.value !== "string") continue;
		if (!DOCUMENT_TOP_LEVEL.has(key.key.value)) throw new Error(`persistMasterKey: ${file} has unknown top-level key "${key.key.value}"; refusing to rewrite it`);
	}
	const version = root.get("version");
	if (version !== 1) throw new Error(`persistMasterKey: ${file} declares version ${JSON.stringify(version)}; refusing to rewrite it`);
	if (refs) document.setIn(["refs", MASTER_KEY_REF], masterKey);
	else document.set("refs", { [MASTER_KEY_REF]: masterKey });
	return document.toString();
}
/**
* Generate and persist a fresh master key (0600) in the DSH credentials document.
*
* The key is added under `refs` by editing the parsed document, then written
* with an atomic tmp+rename, so every other credential — and the comments and
* formatting DSH services rely on — survives. Never rewrite the whole file from
* a rebuilt view: that would silently drop entries this build does not model.
*/
function persistMasterKey(dshHome, masterKey) {
	const file = join(dshHome, ".credentials.yaml");
	mkdirSync(dirname(file), { recursive: true });
	const existingText = existsSync(file) ? readFileSync(file, "utf8") : "";
	if (existingText.length > 0 && readCredentialsDocument(file).has("AGY_MASTER_KEY")) throw new Error(`persistMasterKey: ${MASTER_KEY_REF} already exists in ${file}`);
	const next = renderWithMasterKey(existingText, masterKey, file);
	const tmp = `${file}.tmp-masterkey`;
	writeFileSync(tmp, next, { mode: 384 });
	renameSync(tmp, file);
}
/**
* Resolve (load or create) the master key for a dsh home, then build the codec.
* Creating a key writes the credentials document; read-only setups should call
* {@link loadMasterKey} first and surface a friendly error instead.
*/
function resolveMasterKeyCodec(dshHome) {
	let masterKey = loadMasterKey(dshHome);
	let created = false;
	if (!masterKey) {
		masterKey = randomBytes(32).toString("hex");
		persistMasterKey(dshHome, masterKey);
		created = true;
	}
	return {
		codec: createAesGcmCodec(deriveKey(masterKey)),
		created
	};
}
//#endregion
//#region src/store/paths.ts
/**
* The `agy` data folder: every data file this plugin creates lives under
* `$DSH_HOME/agy/` instead of scattered across the DSH home.
*
* Why one folder: agy owned five JSON files sitting directly in `$DSH_HOME`
* (accounts, stats, models, thinking, fingerprint override) next to the host's
* own files. A folder is the boundary a user can see, back up, or delete whole.
*
* Migration is a ONE-SHOT ATOMIC RENAME, not a read-merge with lazy fallback:
*
* - `agy/` sits on the same filesystem as `$DSH_HOME`, so `rename` is atomic
*   and preserves the 0600 mode.
* - A read-merge would need every store to carry two paths, two file locks,
*   and per-store merge logic — and the merge itself can still lose updates
*   (accounts mutate, stats counts).
* - A lazy fallback reads the old path forever, which defeats the point: the
*   old file would never leave the home directory.
*
* Version-skew window contract: after a migration an OLD build recreates its
* legacy file, and its writes are invisible to the new layout — the both-files
* warning in `migrateToAgyDir` is the detector for exactly that (it fires when
* a later process finds both files present). Local SOP re-syncs all profiles at
* once, so the window is one app restart; npm users restart every dsh surface
* per the release note. Accounts logged in by an old CLI during skew need one
* re-login — enumerable, one-time, accepted in exchange for zero merge code.
*/
/** The directory under `$DSH_HOME` holding every agy data file. */
function agyDataDir(dshHome = resolveDshHome()) {
	return join(dshHome, "agy");
}
/** A data file inside the agy directory. */
function agyDataFile(name, dshHome = resolveDshHome()) {
	return join(agyDataDir(dshHome), name);
}
/**
* One-time legacy -> `agy/` migration for one data file.
*
* 1. New file already present: warn-once (via `skew`) when the legacy file is
*    ALSO present — an old-version process is still writing the old path.
*    Return the new path regardless: the new layout wins once it exists.
* 2. No legacy file: fresh install (or already migrated), nothing to do.
* 3. Otherwise create the directory and rename. On ANY failure (`agy/` cannot
*    be created, EXDEV, permissions, a locked target on Windows) fall back to
*    the LEGACY path for this process: for accounts, the old layout with the
*    real pool beats a new empty one, and `skew` surfaces the reason instead
*    of hiding it.
*
* The caller decides what `skew` becomes; `plugin-common.ts` and the CLI log
* it once per process at most.
*/
function migrateToAgyDir(name, dshHome = resolveDshHome()) {
	const legacy = join(dshHome, name);
	const file = agyDataFile(name, dshHome);
	if (existsSync(file)) return {
		file,
		migrated: false,
		skew: existsSync(legacy)
	};
	if (!existsSync(legacy)) return {
		file,
		migrated: false,
		skew: false
	};
	try {
		mkdirSync(agyDataDir(dshHome), { recursive: true });
		renameSync(legacy, file);
		return {
			file,
			migrated: true,
			skew: false
		};
	} catch {
		return {
			file: legacy,
			migrated: false,
			skew: true
		};
	}
}
//#endregion
//#region src/runtime/rotation.ts
const BACKOFF_TIERS_MS = [
	5e3,
	1e4,
	2e4,
	3e4,
	6e4
];
function backoffFor(consecutiveFailures, maxJitterMs = 1e3) {
	const index = Math.min(Math.max(consecutiveFailures, 0), BACKOFF_TIERS_MS.length - 1);
	return (BACKOFF_TIERS_MS[index] ?? BACKOFF_TIERS_MS[BACKOFF_TIERS_MS.length - 1]) + Math.floor(Math.random() * maxJitterMs);
}
/** Whether the account is currently in a cooldown window. */
function isCoolingDown(account, now = Date.now()) {
	return (account.coolingDownUntil ?? 0) > now;
}
/** Whether the requested model family on this account is rate-limited. */
function isFamilyRateLimited(account, family, now = Date.now()) {
	if (!family) return false;
	const resetAt = account.rateLimitResetTimes?.[family];
	return typeof resetAt === "number" && resetAt > now;
}
/**
* Proxy for a pool-level probe that belongs to no single account (the version
* feeds): the account that would serve the next request, else the first usable
* one.
*
* These feeds are not account-scoped, but the host's IP is what a user who
* configured per-account proxies asked to hide, and a probe on the env/direct
* route leaks it at boot. `undefined` means "no account route" — no accounts, or
* no usable one — and the caller then uses the env/direct route, which is also
* where an unproxied account's traffic goes anyway.
*
* Deliberately not model-aware: the probe runs once at boot, before any model is
* requested.
*/
function pickProbeProxyUrl(accounts, activeIndex, now = Date.now()) {
	const usable = (account) => account !== void 0 && account.enabled !== false && !isCoolingDown(account, now);
	const active = accounts[activeIndex];
	if (usable(active)) return active.proxy;
	return accounts.find((account) => usable(account))?.proxy;
}
/** Record a rate-limit reset for one model key, retaining the latest reset time. */
function recordRateLimit(account, modelKey, resetAtMs) {
	const current = account.rateLimitResetTimes?.[modelKey] ?? 0;
	account.rateLimitResetTimes = {
		...account.rateLimitResetTimes ?? {},
		[modelKey]: Math.max(current, resetAtMs)
	};
}
/** Clear expired rate limits and cooldowns in place. */
function clearExpiredState(account, now = Date.now()) {
	if (account.rateLimitResetTimes) {
		const fresh = Object.fromEntries(Object.entries(account.rateLimitResetTimes).filter(([, reset]) => reset > now));
		account.rateLimitResetTimes = Object.keys(fresh).length > 0 ? fresh : void 0;
	}
	if (account.coolingDownUntil && account.coolingDownUntil <= now) {
		account.coolingDownUntil = void 0;
		account.cooldownReason = void 0;
		account.cooldownSetAt = void 0;
	}
}
/** 24h cooldown for a fully exhausted daily quota (single-account: stop hitting the wall). */
const FULL_QUOTA_COOLDOWN_MS = 864e5;
/** Cap for a server-reported reset time on per-minute limits (guards against bogus far-future values). */
const MAX_RATE_LIMIT_COOLDOWN_MS = 18e5;
/**
* How long a verification challenge parks an account before the pool tries it
* again. Deliberately short and timed rather than permanent: the credential is
* intact, the wall is upstream's, and it can clear on its own — so the account
* returns to service without the user doing anything, while still not being
* hammered in the meantime.
*/
const VERIFICATION_COOLDOWN_MS = 9e5;
/** Absolute server-reported reset in ms when it lies in the future, else undefined. */
function parseFutureResetMs$1(resetTime, now = Date.now()) {
	if (!resetTime) return void 0;
	const reset = Date.parse(resetTime);
	if (Number.isNaN(reset) || reset <= now) return void 0;
	return reset;
}
/**
* Decide what to do after one failed attempt.
* @param kind - classified failure kind.
* @param category - 429 sub-category when kind is rate-limit.
* @param account - the account that failed (mutated with cooldown/rate-limit state).
* @param consecutiveFailures - consecutive failures on this account.
* @param retryAfterMs - server-provided retry delay when present.
* @param resetTime - server-provided absolute reset time; cooldowns use it (capped) instead of fixed windows.
*/
function decideRotation(kind, account, consecutiveFailures, retryAfterMs, category = "unknown", resetTime) {
	const now = Date.now();
	const backoffMs = backoffFor(consecutiveFailures);
	switch (kind) {
		case "rate-limit": {
			if (category === "soft_rate_limit") return {
				action: "retry",
				backoffMs: Math.min(retryAfterMs ?? backoffMs, 3e3)
			};
			if (category === "quota_exhausted") {
				const resetMs = parseFutureResetMs$1(resetTime, now);
				const cooldownMs = resetMs !== void 0 ? Math.min(resetMs - now, FULL_QUOTA_COOLDOWN_MS) : FULL_QUOTA_COOLDOWN_MS;
				account.coolingDownUntil = now + Math.max(cooldownMs, 6e4);
				account.cooldownReason = "quota-exhausted";
				account.cooldownSetAt = now;
				return {
					action: "cool",
					backoffMs: Math.max(cooldownMs, 6e4)
				};
			}
			const resetMs = parseFutureResetMs$1(resetTime, now);
			const cooldownMs = resetMs !== void 0 ? Math.min(resetMs - now, MAX_RATE_LIMIT_COOLDOWN_MS) : retryAfterMs ?? 3e5;
			return {
				action: "rotate",
				backoffMs: Math.max(cooldownMs, 1e3)
			};
		}
		case "auth-failure":
			account.verificationRequired = true;
			account.verificationRequiredAt = now;
			account.verificationRequiredReason = "auth-failure";
			account.enabled = false;
			return { action: "revoke" };
		case "verification-required":
			account.coolingDownUntil = now + VERIFICATION_COOLDOWN_MS;
			account.cooldownReason = "validation-required";
			account.cooldownSetAt = now;
			account.verificationRequired = true;
			account.verificationRequiredAt = now;
			account.verificationRequiredReason = "validation-required";
			return {
				action: "cool",
				backoffMs: VERIFICATION_COOLDOWN_MS
			};
		case "network-error":
			account.coolingDownUntil = now + backoffMs;
			account.cooldownReason = "network-error";
			account.cooldownSetAt = now;
			return {
				action: "rotate",
				backoffMs
			};
		case "project-error":
			account.coolingDownUntil = now + backoffMs;
			account.cooldownReason = "project-error";
			account.cooldownSetAt = now;
			return {
				action: "cool",
				backoffMs
			};
		case "request-error": return { action: "noop" };
		case "transient": return {
			action: "retry",
			backoffMs
		};
		case "proxy-unreachable": return {
			action: "rotate",
			backoffMs: Math.min(backoffMs, 1e3)
		};
	}
}
/**
* Pick the next account index for rotation (round-robin across enabled,
* non-cooling accounts; falls back to the active one when all are cooling).
*/
function pickNextAccountIndex(accounts, currentIndex, now = Date.now(), modelOrFamily) {
	if (accounts.length <= 1) return currentIndex;
	const enabled = accounts.map((a, i) => ({
		account: a,
		index: i
	})).filter(({ account, index }) => {
		if (index === currentIndex || account.enabled === false) return false;
		if (isCoolingDown(account, now)) return false;
		if (modelOrFamily && isFamilyRateLimited(account, modelOrFamily, now)) return false;
		if (modelOrFamily && account.cachedModels && account.cachedModels.length > 0) {
			if (!account.cachedModels.includes(modelOrFamily)) {
				const base = modelOrFamily.replace(/-(?:low|medium|high|tiered)$/, "");
				if (!account.cachedModels.some((m) => m === modelOrFamily || m.startsWith(base + "-"))) return false;
			}
		}
		return true;
	});
	if (enabled.length === 0) return currentIndex;
	return (enabled.find((e) => e.index > currentIndex) ?? enabled[0]).index;
}
/**
* Build the soft-quota cache TTL: short when low, long when healthy.
*
* Driven by the MOST pressured of the two windows, because they drain on
* different clocks: an account sitting at 90% of its 5-hour bucket but 2% of its
* week still has to be re-measured on the short interval, or a weekly exhaustion
* is discovered only when a request fails.
*
* `weeklyFraction` is the optional SECOND parameter, so the two fractions sit
* adjacent.
*
* Takes NO timestamp on purpose: deciding which fractions are still meaningful is
* `isQuotaStale`'s job, because a window whose reset has passed must not drive the
* interval either. It applies that guard before calling in here, so both
* arguments this function sees describe windows that still exist.
*/
function computeSoftQuotaCacheTtlMs(remainingFraction, weeklyFraction) {
	if (typeof remainingFraction === "number" && remainingFraction < .15) return 6e4;
	if (typeof weeklyFraction === "number" && weeklyFraction <= .01) return 6e4;
	if (typeof remainingFraction !== "number" && typeof weeklyFraction !== "number") return 6e5;
	if (typeof remainingFraction === "number" && remainingFraction < .5) return 3e5;
	if (typeof weeklyFraction === "number" && weeklyFraction < .2) return 3e5;
	return 9e5;
}
//#endregion
//#region src/runtime/version.ts
/**
* Fresh Antigravity client version resolution: fetch from the product's own
* release feeds (6h TTL, single in-flight dedupe), falling back to the pinned
* pool. Keeps fingerprint User-Agent version strings current — a stale version
* is the most detectable fingerprint anomaly.
*/
const VERSION_CACHE_TTL_MS = 216e5;
const VERSION_FETCH_TIMEOUT_MS = 5e3;
/** Source 2: agy CLI GitHub releases (object with tag_name). */
const CLI_RELEASE_URL = "https://api.github.com/repos/google-antigravity/antigravity-cli/releases/latest";
/** Source 3: Antigravity Hub updater manifest (yaml with version: string). */
const HUB_MANIFEST_URL = "https://antigravity-hub-auto-updater-974169037036.us-central1.run.app/manifest/latest-arm64-mac.yml";
function compareSemver(a, b) {
	const pa = a.split(".").map((n) => Number(n) || 0);
	const pb = b.split(".").map((n) => Number(n) || 0);
	for (let i = 0; i < 3; i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}
function pickNewestVersion(...versions) {
	const valid = versions.filter((v) => typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v));
	if (valid.length === 0) return null;
	return valid.reduce((best, v) => !best || compareSemver(v, best) > 0 ? v : best, null);
}
/**
* Highest version published so far in this process.
*
* Kept locally so publication is monotonic: the two feeds resolve independently
* and either may finish first, so without this the slower (possibly older) source
* could lower what a User-Agent already advertises. A version never goes
* backwards here — only the cold-start floor can be below a published value.
*/
let publishedVersion;
/**
* Publish a newly observed version into the shared slot every User-Agent builder
* reads ({@link setResolvedAgyVersion}), never lowering an already-published one.
*/
function publishVersion(version) {
	if (version === null || version === void 0) return;
	if (compareSemver(version, "2.0.0") < 0) return;
	const best = pickNewestVersion(version, publishedVersion);
	if (best === null || best === publishedVersion) return;
	publishedVersion = best;
	setResolvedAgyVersion(best);
}
function parseCliRelease(payload) {
	if (!payload || typeof payload !== "object") return null;
	const release = payload;
	return pickNewestVersion(release.tag_name ?? release.name);
}
function parseHubManifest(payload) {
	if (typeof payload !== "string") return null;
	return payload.match(/^version:\s*(\d+\.\d+\.\d+)\s*$/m)?.[1] ?? null;
}
async function fetchJsonWithTimeout(fetchImpl, url) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT_MS);
	try {
		const response = await fetchImpl(url, {
			headers: {
				Accept: "*/*",
				"User-Agent": antigravityUserAgent()
			},
			signal: controller.signal
		});
		if (!response.ok) throw new Error(`Version source ${url} returned ${response.status}`);
		if (url.endsWith(".yml") || url.endsWith(".yaml")) return response.text();
		return response.json();
	} finally {
		clearTimeout(timeoutId);
	}
}
/**
* Resolve the newest OBSERVED version from one feed, or `undefined` when the
* feed yielded nothing.
*
* Returning `undefined` rather than the pinned fallback is what keeps the
* fallback out of {@link resolveAntigravityVersion}'s cross-source `max`. When
* this returned the fallback, a source that simply failed to parse contributed
* the fallback as though it were evidence, and once the fallback was raised to
* track the live feed it started outranking genuine — but older — feed data.
* The fallback is a last resort and is applied once, at the public boundary.
*/
async function resolveObservedVersion(state, sourceUrl, parse, fetchImpl) {
	const now = Date.now();
	if (state.cache && now - state.cache.fetchedAt < VERSION_CACHE_TTL_MS) {
		publishVersion(state.cache.version);
		return state.cache.version;
	}
	if (state.inFlight) return state.inFlight;
	state.inFlight = (async () => {
		let resolved = null;
		try {
			resolved = parse(await fetchJsonWithTimeout(fetchImpl, sourceUrl));
		} catch {
			resolved = null;
		}
		const observed = pickNewestVersion(resolved, state.cache?.version);
		if (resolved) {
			state.cache = {
				version: observed ?? resolved,
				fetchedAt: Date.now()
			};
			publishVersion(resolved);
		}
		return observed ?? void 0;
	})();
	try {
		return await state.inFlight;
	} finally {
		state.inFlight = null;
	}
}
/**
* The newest version actually OBSERVED on the claimed product's feed, or
* `undefined` when it yielded nothing.
*
* Reads the **CLI feed only**. This used to take the numeric max across the IDE
* and CLI feeds, which is a category error: the three Antigravity lines are
* separate version namespaces (IDE 2.x, hub 2.15.x, CLI 1.2.x), so "newest"
* across them compares unrelated numbers and picks whichever line happens to
* count higher. Since this client claims to be the CLI
* (`docs/official-identity.json`), the CLI feed is the only one that can
* describe the version we are entitled to advertise; the IDE resolver stays
* exported for the freshness gate's cross-check, never for the wire.
*
* Distinct from {@link resolveAntigravityVersion}, which substitutes the pinned
* fallback at the boundary. A caller that must tell "observed" from "assumed"
* cannot use that one — and the freshness gate is exactly such a caller, since
* the fallback is the value under test.
*/
async function resolveObservedAgyVersion(fetchImpl = proxiedFetch) {
	const hub = await resolveObservedVersion(hubState, HUB_MANIFEST_URL, parseHubManifest, fetchImpl);
	if (hub && compareSemver(hub, "2.0.0") >= 0) return hub;
	const cli = await resolveObservedVersion(cliState, CLI_RELEASE_URL, parseCliRelease, fetchImpl);
	if (cli && compareSemver(cli, "2.0.0") >= 0) return cli;
}
/** Best available version: the claimed product line, cached 6h. */
async function resolveAntigravityVersion(fetchImpl = proxiedFetch) {
	return await resolveObservedAgyVersion(fetchImpl) ?? "2.28.2";
}
/**
* Bounded resolve for fingerprint generation: never block the failure path on
* cold version feeds. Resolves undefined on timeout/error so callers fall
* back to the pinned version pool; the abandoned fetch keeps running and
* populates the 6h cache for later calls.
*
* `fetchImpl` routes the probe: the feeds belong to no account, so the caller
* decides which egress they use (the CLI passes the login proxy, the plugin
* passes the pool's representative account).
*/
async function resolveAntigravityVersionBounded(timeoutMs = 750, fetchImpl = proxiedFetch) {
	let timer;
	try {
		return await Promise.race([resolveAntigravityVersion(fetchImpl).catch(() => void 0), new Promise((resolve) => {
			timer = setTimeout(() => resolve(void 0), timeoutMs);
		})]);
	} finally {
		clearTimeout(timer);
	}
}
/** Synchronously peek at a fresh cached version (no network). */
function peekCachedAntigravityVersion() {
	const now = Date.now();
	for (const state of [
		hubState,
		cliState,
		ideState
	]) if (state.cache && now - state.cache.fetchedAt < VERSION_CACHE_TTL_MS) {
		publishVersion(state.cache.version);
		return state.cache.version;
	}
}
const hubState = { inFlight: null };
const ideState = { inFlight: null };
const cliState = { inFlight: null };
//#endregion
//#region src/oauth/refresh.ts
var AgyTokenRefreshError = class extends Error {
	code;
	description;
	status;
	statusText;
	constructor(options) {
		super(options.message);
		this.name = "AgyTokenRefreshError";
		this.code = options.code;
		this.description = options.description;
		this.status = options.status;
		this.statusText = options.statusText;
	}
};
/** Parse Google token-endpoint error payloads, tolerating varied shapes. */
function parseOAuthErrorPayload(text) {
	if (!text) return {};
	try {
		const payload = JSON.parse(text);
		if (!payload || typeof payload !== "object") return { description: text };
		let code;
		if (typeof payload.error === "string") code = payload.error;
		else if (payload.error && typeof payload.error === "object") {
			code = payload.error.status ?? payload.error.code;
			if (!payload.error_description && payload.error.message) return {
				code,
				description: payload.error.message
			};
		}
		const description = payload.error_description;
		if (description) return {
			code,
			description
		};
		if (payload.error && typeof payload.error === "object" && payload.error.message) return {
			code,
			description: payload.error.message
		};
		return { code };
	} catch {
		return { description: text };
	}
}
/**
* Refresh the access token for an account. `revoked` means Google rejected the
* refresh token (`invalid_grant`) — the account must be re-authenticated.
* For legacy accounts without a stored clientId, embedded credentials are tried
* first with an env-override fallback before treating invalid_grant as fatal.
*/
async function refreshAccessToken(auth, options) {
	const parts = parseRefreshParts(auth.refresh);
	if (!parts.refreshToken) return {
		type: "failed",
		error: new AgyTokenRefreshError({
			message: "Missing refresh token",
			status: 400,
			statusText: "Bad Request"
		})
	};
	const candidateIds = options?.clientId ? [options.clientId] : Array.from(new Set([AGY_CLIENT_ID, process.env.AGY_CLIENT_ID].filter((id) => Boolean(id && id.length > 0))));
	let revokedCount = 0;
	let transientFailure;
	for (const currentClientId of candidateIds) try {
		const startTime = Date.now();
		const { clientId, clientSecret } = resolveAgyClientCredentials(currentClientId);
		const response = await proxiedFetch(OAUTH_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: parts.refreshToken,
				client_id: clientId,
				client_secret: clientSecret
			})
		}, options?.proxyUrl ? { proxyUrl: options.proxyUrl } : void 0);
		if (!response.ok) {
			const errorText = await response.text().catch(() => void 0);
			const { code, description } = parseOAuthErrorPayload(errorText);
			const details = [code, description ?? errorText].filter(Boolean).join(": ");
			const baseMessage = `Agy token refresh failed (${response.status} ${response.statusText})`;
			const message = details ? `${baseMessage} - ${details}` : baseMessage;
			if (code === "invalid_grant") {
				revokedCount++;
				continue;
			}
			transientFailure = {
				type: "failed",
				error: new AgyTokenRefreshError({
					message,
					code,
					description: description ?? errorText,
					status: response.status,
					statusText: response.statusText
				})
			};
			continue;
		}
		const payload = await response.json();
		const refreshedParts = {
			refreshToken: payload.refresh_token ?? parts.refreshToken,
			projectId: parts.projectId,
			managedProjectId: parts.managedProjectId
		};
		return {
			type: "success",
			auth: {
				access: payload.access_token,
				expires: calculateTokenExpiry(startTime, payload.expires_in),
				refresh: formatRefreshParts(refreshedParts)
			},
			clientId
		};
	} catch (error) {
		const raw = error instanceof Error ? error : new Error(String(error));
		const code = error?.code;
		const errorCode = error?.errorCode;
		const wrapped = new AgyTokenRefreshError({
			message: raw.message,
			status: 0,
			statusText: "Network Error",
			code: code ?? errorCode,
			description: raw.message
		});
		wrapped.cause = error;
		if (code) wrapped.code = code;
		if (errorCode) wrapped.errorCode = errorCode;
		transientFailure = {
			type: "failed",
			error: wrapped
		};
	}
	if (transientFailure) return transientFailure;
	if (revokedCount === candidateIds.length) return { type: "revoked" };
	return {
		type: "failed",
		error: new AgyTokenRefreshError({
			message: "Token refresh failed on all candidate client IDs",
			status: 400,
			statusText: "Bad Request"
		})
	};
}
const DAY_MS = 864e5;
/** Floor for remaining-time in drain-urgency scores (mirrors AuthStorage; a stale reset must not explode the score). */
const DRAIN_FLOOR_MS = 6e4;
/** Map a model id to its backend quota counter family (OMP getAntigravityCounterKeyForModel). */
function modelFamilyOf(modelId) {
	if (!modelId) return void 0;
	const id = modelId.toLowerCase();
	if (id.startsWith("claude-")) return "anthropic";
	if (id.startsWith("gemini-") || id.startsWith("gemma-")) return "google";
	if (id.startsWith("gpt-") || id.startsWith("openai/")) return "openai";
}
/** Quota-cache key for a request: the model's family, or the unknown bucket. */
function familyKeyOf(modelId) {
	return modelFamilyOf(modelId) ?? "unknown";
}
function earliestResetTime(a, b) {
	if (!a) return b;
	if (!b) return a;
	const ta = Date.parse(a);
	const tb = Date.parse(b);
	if (Number.isNaN(ta)) return b;
	if (Number.isNaN(tb)) return a;
	return ta <= tb ? a : b;
}
/**
* The families a quota group's WINDOW BUCKET ID belongs to.
*
* `retrieveUserQuotaSummary` labels its buckets with upstream's own counters —
* measured ids are `gemini-5h`, `gemini-weekly`, `3p-5h`, `3p-weekly` — which
* is the same taxonomy `modelFamilyOf` mirrors. Reading the bucket id is
* therefore a machine-readable lookup rather than a guess at a human label.
*
* `3p-` maps to TWO families on purpose, and that is not a shortcut: upstream
* counts Claude and GPT under one third-party counter, so the weekly budget
* belongs to both. No model-id prefix rule can recover that split, which is why
* the mapping lives here rather than in `modelFamilyOf`.
*
* Window-aware as of #56: a bucket id resolves a family only when the window it
* describes is one `CachedQuota` can hold AND the id agrees with the token (see
* `agreedWindowKind`). The prefix and the window were two independent decisions
* once, and an unrecognized window still claimed a family.
*/
function familiesForBucketId(bucketId, window) {
	const id = bucketId.toLowerCase();
	const families = [];
	if (id.startsWith("gemini-")) families.push("google");
	else if (id.startsWith("3p-") || id.startsWith("third_party-")) families.push("anthropic", "openai");
	else if (id.startsWith("claude-")) families.push("anthropic");
	else if (id.startsWith("gpt-") || id.startsWith("openai-")) families.push("openai");
	if (families.length === 0) return [];
	const declared = window === void 0 ? advertisedWindowOf(id) : window.toLowerCase();
	if (declared === void 0 || agreedWindowKind(id, declared) === void 0) return [];
	return families;
}
/**
* The families a group's LABEL covers, consulted only when no bucket id was
* recognizable.
*
* Upstream's groups are its own taxonomy, not ours, and the measured labels are
* `Gemini Models` and `Claude and GPT models` — the second spans two families,
* so this is a 1-to-N mapping. It is a FALLBACK, not the primary rule: matching
* words in a display string is the fragile half, and it survives only so that a
* bucket id upstream renames still lands somewhere sensible.
*
* A label naming nothing we recognize maps to NO family deliberately.
* Attributing an unknown group's budget to `google` would block healthy
* accounts; leaving it unmapped only means that family stays unmeasured, which
* is exactly the state before this function existed.
*/
function familiesForGroupName(name) {
	const label = name.toLowerCase();
	const families = [];
	if (label.includes("gemini") || label.includes("google")) families.push("google");
	const claude = label.includes("claude");
	const gpt = label.includes("gpt");
	if (claude && gpt) families.push("anthropic", "openai");
	else if (claude) families.push("anthropic");
	else if (gpt) families.push("openai");
	return families;
}
/**
* Which of the two tracked windows an upstream token names, or `undefined` for a
* token `CachedQuota` has no field for (`daily`, `monthly`).
*
* Read from `QUOTA_WINDOWS` (`types.ts`), the SAME table `adapter/quota-summary`
* orders windows by. These were two independent tables once, and the gap between
* them was a real defect: `daily` was orderable in the parser but unknown here, so
* the group materialized an empty record that overwrote a live measurement. One
* table makes that drift structurally impossible rather than merely tested for.
*
* Lookup is exact on the measured vocabulary (`5h`, `weekly`). A variant spelling
* therefore classifies as unknown — which is safe, because the guard in
* `ingestQuotaGroups` then skips the record rather than emptying it, and the
* per-model probe still supplies the 5-hour reading.
*/
function windowKind(window) {
	return QUOTA_WINDOWS[window.toLowerCase()]?.kind;
}
/** The window token a bucket id advertises, when it ends with one upstream names. */
function advertisedWindowOf(bucketId) {
	const id = bucketId.toLowerCase();
	const token = id.slice(id.lastIndexOf("-") + 1);
	return QUOTA_WINDOWS[token] ? token : void 0;
}
/**
* The field a window belongs in, decided from an AGREED (id, token) pair — or
* `undefined` when the pair cannot be agreed.
*
* The family used to come from the bucket id's prefix while the field came from
* the window token, as two independent decisions nothing checked against each
* other. A bucket whose window the cache cannot hold still claimed the family,
* and its reading was then filed by whichever field the TOKEN named. `gemini-weekly`
* declaring `5h` is the shape that puts a multi-day weekly fraction into
* `remainingFraction` (the 5-hour field), where `isFamilyDrained` and
* `parseFutureResetMs` block the account for days on a window they misread.
*
* Refusing an unagreed pair is deliberately the strict option: the permissive
* mapping is exactly the coupling that let two window vocabularies drift into
* destroying a measurement. A bucket id that advertises no recognizable token is
* held to the declared one alone, so a rename does not silently disable the cache.
*/
function agreedWindowKind(bucketId, window) {
	const declared = window.toLowerCase();
	const kind = windowKind(declared);
	if (kind === void 0) return void 0;
	const advertised = advertisedWindowOf(bucketId);
	if (advertised !== void 0 && advertised !== declared) return void 0;
	return kind;
}
/** The families one group belongs to: its bucket ids first, its label second. */
function familiesForGroup(group) {
	const families = [];
	const add = (family) => {
		if (!families.includes(family)) families.push(family);
	};
	for (const window of group.windows) for (const family of familiesForBucketId(window.bucketId, window.window)) add(family);
	if (families.length === 0) for (const family of familiesForGroupName(group.name)) add(family);
	return families;
}
/**
* Aggregate the grouped `retrieveUserQuotaSummary` windows into per-family
* records — the ONLY source of the weekly window.
*
* `fetchAvailableModels` cannot supply it: its `quotaInfo` carries exactly
* `remainingFraction` and `resetTime`, with no window field at all, which is why
* a weekly limit used to be invisible to rotation.
*
* Two groups can land on one family (upstream may split `3p` later), so the
* family record keeps the MOST pressured reading of each window across those
* groups (`Math.min` below) rather than letting the last group win — the same
* rule the per-model merge uses.
*
* WITHIN one group the rule is deliberately different: `??=` keeps upstream's
* FIRST bucket of each window, because a group is upstream's own 5h + weekly
* pair and a duplicate would otherwise depend on upstream's ordering. "Most
* pressured" therefore applies to two GROUPS landing on one family, not to two
* buckets inside one group.
*/
function ingestQuotaGroups(groups) {
	const families = /* @__PURE__ */ new Map();
	for (const group of groups) {
		const keys = familiesForGroup(group);
		if (keys.length === 0) continue;
		let rolling;
		let weekly;
		for (const window of group.windows) {
			const kind = agreedWindowKind(window.bucketId, window.window);
			if (kind === "rolling") rolling ??= window;
			else if (kind === "weekly") weekly ??= window;
		}
		for (const key of keys) {
			const current = families.get(key);
			const record = { ...current };
			if (typeof rolling?.remainingFraction === "number") {
				record.remainingFraction = current?.remainingFraction === void 0 ? rolling.remainingFraction : Math.min(current.remainingFraction, rolling.remainingFraction);
				const resetTime = earliestResetTime(current?.resetTime, rolling.resetTime ?? void 0);
				if (resetTime) record.resetTime = resetTime;
			}
			if (typeof weekly?.remainingFraction === "number") {
				record.weeklyFraction = current?.weeklyFraction === void 0 ? weekly.remainingFraction : Math.min(current.weeklyFraction, weekly.remainingFraction);
				const weeklyResetTime = earliestResetTime(current?.weeklyResetTime, weekly.resetTime ?? void 0);
				if (weeklyResetTime) record.weeklyResetTime = weeklyResetTime;
			}
			if (record.remainingFraction === void 0 && record.weeklyFraction === void 0 && !current) continue;
			families.set(key, record);
		}
	}
	return Object.fromEntries(families);
}
/**
* Aggregate a `fetchAvailableModels` response, and when available the grouped
* `retrieveUserQuotaSummary` windows, into per-family quota records.
*
* The two sources describe the same counters from different angles, so they are
* merged rather than kept apart:
*   - per MODEL `quotaInfo.remainingFraction` is the rolling 5-hour counter, and
*     the family takes its most-pressured model (the bottleneck resets first);
*   - per GROUP summary windows add the weekly budget, which has no per-model
*     representation at all.
*
* `previous` is the account's existing cache, and it exists so a probe that
* reports only one of the two windows cannot ERASE the other. The measured
* reason: `fetchQuotaSummary` returns `[]` instead of throwing, so without the
* carry-forward one timing-out endpoint would drop a known-drained weekly window
* and put an exhausted account straight back into rotation.
*
* Carrying that value is safe next to a fresh 5-hour reading because it keeps its
* own `weeklyResetTime`: once that moment passes, `isFamilyDrained` and
* `parseFutureResetMs` both ignore the reading, so a stale weekly cannot outlive
* the window it describes.
*/
function ingestFamilyQuotas(discovered, groups, previous) {
	const families = /* @__PURE__ */ new Map();
	if (groups && groups.length > 0) for (const [key, quota] of Object.entries(ingestQuotaGroups(groups))) families.set(key, { ...quota });
	for (const [modelId, entry] of Object.entries(discovered.models ?? {})) {
		const remaining = entry.quotaInfo?.remainingFraction;
		if (typeof remaining !== "number" || !Number.isFinite(remaining)) continue;
		const key = familyKeyOf(modelId);
		const current = families.get(key);
		const resetTime = earliestResetTime(current?.resetTime, entry.quotaInfo?.resetTime);
		families.set(key, {
			...current,
			remainingFraction: current?.remainingFraction === void 0 ? remaining : Math.min(current.remainingFraction, remaining),
			...resetTime ? { resetTime } : {},
			modelCount: (current?.modelCount ?? 0) + 1
		});
	}
	if (previous) for (const [key, prev] of Object.entries(previous)) {
		const current = families.get(key);
		if (prev.weeklyFraction === void 0) continue;
		if (current?.weeklyFraction !== void 0) continue;
		families.set(key, {
			...current,
			weeklyFraction: prev.weeklyFraction,
			...current?.weeklyResetTime === void 0 && prev.weeklyResetTime !== void 0 ? { weeklyResetTime: prev.weeklyResetTime } : {}
		});
	}
	return Object.fromEntries(families);
}
/**
* The lowest fraction a record reports across its LIVE windows — its overall
* pressure.
*
* A window whose reset has already passed describes a window that no longer
* exists, so it does not count — the same rule `isQuotaStale` applies when it
* sizes the TTL from the selected record. Scoring a dead window would let one
* family's expired weekly reading win the selection and represent the account,
* masking another family's live pressure (issue #69: a dead weekly at 0.004
* beat a live 0.2 and stretched the refresh TTL from 5 to 15 minutes).
*
* `undefined` means the record carries no usable LIVE reading at all, which is
* deliberately different from a measured zero: only a real number can size a
* refresh interval.
*/
function pressureScore(entry, now) {
	const fractions = [];
	if (typeof entry.remainingFraction === "number" && Number.isFinite(entry.remainingFraction) && !resetInPast(entry.resetTime, now)) fractions.push(entry.remainingFraction);
	if (typeof entry.weeklyFraction === "number" && Number.isFinite(entry.weeklyFraction) && !resetInPast(entry.weeklyResetTime, now)) fractions.push(entry.weeklyFraction);
	return fractions.length === 0 ? void 0 : Math.min(...fractions);
}
/**
* The quota record for one family, or the most-pressured family when the model
* is unknown.
*
* "Most pressured" compares BOTH windows and reports the record whose LOWEST
* window is the lowest of all of them. That matters because `isQuotaStale` sizes
* the refresh TTL from whichever record this returns: a family at 0.9 / weekly
* 0.004 is more pressured than one at 0.2, and comparing the 5-hour fraction
* alone picked the 0.2 record — so the weekly-driven 60s TTL was never applied
* to the family actually being requested and a spent week was discovered late.
*
* A record carrying ONLY a weekly reading participates for the same reason: #48
* produces that shape legitimately (the anthropic/openai entries of a
* Gemini-only pool), and the old `typeof entry.remainingFraction !== 'number'`
* guard skipped it outright, leaving the week invisible to TTL sizing.
*
* Selection considers LIVE windows only (`pressureScore` drops a window whose
* reset has passed) — but the with-family path returns the record as-is either
* way, because its consumers guard each window individually.
*
* @param account - the account whose cache to read.
* @param family - the exact family's record; omit to select the most pressured.
* @param now - current time (Unix ms), which decides whether a window is live.
*/
function familyQuotaFor(account, family, now = Date.now()) {
	const cache = account.cachedQuota ?? {};
	if (family) return cache[family];
	let worst;
	let worstScore;
	for (const entry of Object.values(cache)) {
		const score = pressureScore(entry, now);
		if (score === void 0) continue;
		if (worstScore === void 0 || score < worstScore) {
			worst = entry;
			worstScore = score;
		}
	}
	return worst;
}
/** Whether the account's quota cache needs a refresh (missing, or past its health-based TTL). */
function isQuotaStale(account, now = Date.now()) {
	if (!account.cachedQuota || !account.cachedQuotaUpdatedAt) return true;
	const mostPressured = familyQuotaFor(account, void 0, now);
	const ttl = computeSoftQuotaCacheTtlMs(resetInPast(mostPressured?.resetTime, now) ? void 0 : mostPressured?.remainingFraction, resetInPast(mostPressured?.weeklyResetTime, now) ? void 0 : mostPressured?.weeklyFraction);
	return now - account.cachedQuotaUpdatedAt > ttl;
}
/** How long a measured 5h/weekly window snapshot stays fresh. */
const LIMITS_CACHE_TTL_MS = 6e5;
/**
* Whether the display-only windows need a refresh.
*
* A SEPARATE rule from `isQuotaStale` on purpose: that one keys off
* `cachedQuota`/`cachedQuotaUpdatedAt`, which the scheduling path fills and a
* SOLO account never does (the pool gate skips it). Reusing it here would report
* "stale" on every single call for a solo account and re-probe the endpoint
* continuously — the exact case this feature exists to serve.
*
* A fixed TTL is also the honest choice: the windows come from their own
* endpoint, so there is no `remainingFraction` on hand to scale the interval by
* without reading the very data being validated.
*
* @param account - the account to test.
* @param now - current time (Unix ms).
*/
function isLimitsStale(account, now = Date.now()) {
	const updatedAt = account.cachedLimits?.updatedAt;
	if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return true;
	return now - updatedAt > LIMITS_CACHE_TTL_MS;
}
/** Whether a reset moment has already passed. An absent or malformed one has not. */
function resetInPast(resetTime, now) {
	if (!resetTime) return false;
	const reset = Date.parse(resetTime);
	return !Number.isNaN(reset) && reset <= now;
}
/**
* Required drain rate: headroomFraction / remainingHours — how fast the
* family's remaining quota must be consumed to avoid expiring unused at its
* reset (mirrors AuthStorage.#computeWindowRequiredDrain with a daily window).
*
* DELIBERATELY FIVE-HOUR ONLY, and this is a decision rather than an omission.
* The weekly window influences `blockedUntil` and `hot` instead of the ranking
* ORDER, because a week is not a spend-by deadline: the `DAY_MS` clamp below
* caps the horizon at 24h, so a weekly reset ~5 days out would report ~24h of
* urgency for a budget that cannot be spent faster to any benefit — and every
* family would then be ranked by a number that no longer distinguishes them.
* Making this weekly-aware therefore means replacing that clamp with a horizon
* the weekly window can actually express, not adding a second fraction to the
* numerator.
*/
function requiredDrainFor(quota, now = Date.now()) {
	const remaining = quota?.remainingFraction;
	if (typeof remaining !== "number" || !Number.isFinite(remaining)) return 0;
	const headroom = Math.min(Math.max(remaining, 0), 1);
	if (headroom <= 0) return 0;
	let remainingMs = DAY_MS;
	const resetTime = quota?.resetTime;
	if (resetTime) {
		const resetAt = Date.parse(resetTime);
		if (!Number.isNaN(resetAt)) remainingMs = Math.min(remainingMs, Math.max(resetAt - now, 0));
	}
	return headroom / (Math.max(remainingMs, DRAIN_FLOOR_MS) / 36e5);
}
function parseFutureResetMs(resetTime, now) {
	if (!resetTime) return void 0;
	const reset = Date.parse(resetTime);
	if (Number.isNaN(reset) || reset <= now) return void 0;
	return reset;
}
/**
* Whether the requested family on this account is effectively quota-exhausted
* for account STEERING (affinity pins, the active-account preference): an
* explicit quota-exhausted cooldown in force, a spent 5-hour window
* (`remainingFraction <= 0` with a future reset), or a weekly window at or
* below `WEEKLY_QUOTA_THRESHOLD` — a spent week refills in days, so its rule
* mirrors `isFamilyDrained`'s weekly branch rather than the block wall.
*
* Deliberately a DIFFERENT predicate from the one in `pickAccount`'s `!picked`
* branch, which applies a strict zero to BOTH windows to mirror
* `rankPoolCandidates`' block wall when classifying `AgyPoolBlockedError`; and
* deliberately NARROWER than `isFamilyDrained`'s 5-hour rule
* (`SOFT_QUOTA_THRESHOLD`): account prioritization holds a chosen account
* until it is actually spent, not until ranking would prefer another one.
*/
function isFamilyQuotaExhausted(account, family, now = Date.now()) {
	if (account.cooldownReason === "quota-exhausted" && (account.coolingDownUntil ?? 0) > now) return true;
	const quota = familyQuotaFor(account, family);
	if (!quota) return false;
	const spent = (fraction, resetTime, threshold = 0) => {
		if (typeof fraction !== "number" || fraction > threshold || !resetTime) return false;
		const resetMs = parseFutureResetMs(resetTime, now);
		return resetMs !== void 0 && resetMs > now;
	};
	return spent(quota.remainingFraction, quota.resetTime, 0) || spent(quota.weeklyFraction, quota.weeklyResetTime, .01);
}
/**
* Rank pool candidates for one request, mirroring AuthStorage's antigravity
* ordering: unblocked first (earliest unblock time among blocked), hot windows
* last, measured usage before unmeasured, required-drain descending, then
* used-fraction ascending. Ties preserve the rotation order seeded from
* `startIndex` so an unmeasured pool keeps the active-account bias.
*/
function rankPoolCandidates(entries, modelId, now = Date.now(), startIndex = 0) {
	const family = modelFamilyOf(modelId);
	const activePos = entries.findIndex((e) => e.index === startIndex);
	const clampedStart = activePos >= 0 ? activePos : 0;
	const candidates = (entries.length === 0 ? [] : [...entries.slice(clampedStart), ...entries.slice(0, clampedStart)]).map(({ account, index }, orderPos) => {
		const quota = familyQuotaFor(account, family, now);
		const live5h = quota !== void 0 && !resetInPast(quota.resetTime, now);
		const liveWeekly = quota !== void 0 && !resetInPast(quota.weeklyResetTime, now);
		const remaining = live5h ? quota.remainingFraction : void 0;
		const used = typeof remaining === "number" ? Math.min(Math.max(1 - remaining, 0), 1) : void 0;
		const weeklyRemaining = liveWeekly ? quota.weeklyFraction : void 0;
		const weeklyUsed = typeof weeklyRemaining === "number" ? Math.min(Math.max(1 - weeklyRemaining, 0), 1) : void 0;
		let blockedUntil = null;
		if (account.coolingDownUntil && account.coolingDownUntil > now) blockedUntil = account.coolingDownUntil;
		const familyLimit = account.rateLimitResetTimes?.[familyKeyOf(modelId)];
		if (familyLimit !== void 0 && familyLimit > now) blockedUntil = blockedUntil === null ? familyLimit : Math.max(blockedUntil, familyLimit);
		if (blockedUntil === null && quota) {
			const resetMs = typeof remaining === "number" && remaining <= 0 ? parseFutureResetMs(quota.resetTime, now) : void 0;
			if (resetMs !== void 0) blockedUntil = resetMs;
			const weeklyResetMs = typeof weeklyRemaining === "number" && weeklyRemaining <= 0 ? parseFutureResetMs(quota.weeklyResetTime, now) : void 0;
			if (weeklyResetMs !== void 0) blockedUntil = blockedUntil === null ? weeklyResetMs : Math.max(blockedUntil, weeklyResetMs);
		}
		return {
			account,
			index,
			orderPos,
			blockedUntil,
			usedFraction: used,
			requiredDrain: requiredDrainFor(quota, now),
			hot: used !== void 0 && used >= .85 || weeklyUsed !== void 0 && weeklyUsed >= .85,
			measured: used !== void 0 || weeklyUsed !== void 0
		};
	});
	candidates.sort((left, right) => {
		const leftBlocked = left.blockedUntil !== null;
		const rightBlocked = right.blockedUntil !== null;
		if (leftBlocked !== rightBlocked) return leftBlocked ? 1 : -1;
		if (leftBlocked && rightBlocked) return (left.blockedUntil ?? 0) - (right.blockedUntil ?? 0);
		if (left.hot !== right.hot) return left.hot ? 1 : -1;
		if (left.measured !== right.measured) return left.measured ? -1 : 1;
		const drain = right.requiredDrain - left.requiredDrain;
		if (drain !== 0) return drain;
		const usedDiff = (left.usedFraction ?? .5) - (right.usedFraction ?? .5);
		if (usedDiff !== 0) return usedDiff;
		return left.orderPos - right.orderPos;
	});
	return candidates.map(({ account, index, blockedUntil, usedFraction, requiredDrain, hot, measured }) => ({
		account,
		index,
		blockedUntil,
		usedFraction,
		requiredDrain,
		hot,
		measured
	}));
}
//#endregion
//#region src/runtime/fingerprint.ts
/**
* Device fingerprint generation for rate-limit mitigation (two layers):
*
* 1. Per-request randomized headers — platform/arch/SDK-client pools.
* 2. Per-account persistent fingerprint — deviceId/sessionToken/UA snapshot
*    with bounded history (≤5 versions, restorable), regenerated when an
*    account's capacity looks exhausted.
*
* All tunable pools live in fingerprint-data.json so they can be updated
* without a code release (the reference implementation stopped at an old
* version string once archived — that staleness is the detectable signal).
*/
const DEFAULT_FINGERPRINT_DATA = {
	comment: "Hot-updatable fingerprint data. Version pools and client strings track the Antigravity Hub product line required by Cloud Code PA for current models.",
	versionPool: ["2.28.2", "2.25.0"],
	platforms: ["darwin/arm64"],
	sdkClients: [
		"google-cloud-sdk vscode_cloudshelleditor/0.1",
		"google-cloud-sdk vscode/1.86.0",
		"google-cloud-sdk vscode/1.87.0",
		"google-cloud-sdk vscode/1.96.0"
	],
	ideTypes: ["ANTIGRAVITY"]
};
/**
* Effective fingerprint data: a user override at `$DSH_HOME/agy/agy-fingerprint-data.json`
* wins when present and parseable (hot-updatable without a code release — the
* bundled copy is compiled in), otherwise the bundled defaults. The legacy
* `$DSH_HOME/agy-fingerprint-data.json` location is migrated once by rename.
*/
let cachedData = null;
function getFingerprintData() {
	if (cachedData) return cachedData;
	try {
		const overrideFile = migrateToAgyDir("agy-fingerprint-data.json", process.env.DSH_HOME ? process.env.DSH_HOME : join(process.env.HOME ?? ".", ".dsh")).file;
		if (existsSync(overrideFile)) {
			const parsed = JSON.parse(readFileSync(overrideFile, "utf8"));
			if (parsed && Array.isArray(parsed.versionPool) && parsed.versionPool.length > 0) {
				cachedData = parsed;
				return cachedData;
			}
		}
	} catch {}
	cachedData = DEFAULT_FINGERPRINT_DATA;
	return cachedData;
}
function randomFrom(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}
/** Generate a randomized device fingerprint representing one apparent device. */
function generateFingerprint(data = getFingerprintData(), version = randomFrom(data.versionPool)) {
	const [osType = "darwin", arch = "arm64"] = randomFrom(data.platforms).split("/");
	return {
		deviceId: randomUUID(),
		sessionToken: randomBytes(16).toString("hex"),
		userAgent: `antigravity/hub/${version} (aidev_client; os_type=${osType}; arch=${arch}; cl=${AGY_HUB_CHANGELIST})`,
		apiClient: randomFrom(data.sdkClients),
		clientMetadata: {
			ideType: randomFrom(data.ideTypes),
			ideVersion: version,
			platform: AGY_PLATFORM_ENUM
		},
		createdAt: Date.now()
	};
}
/**
* Deterministic fallback headers for the `stable` fingerprint mode: the first
* entry of each pool, every call — one fixed client identity instead of
* per-request randomization (OMP-style fixed-client posture).
*/
function getStableHeaders(data = getFingerprintData(), version = data.versionPool[0] ?? "") {
	const platform = data.platforms[0] ?? "darwin/arm64";
	const resolved = version || currentAgyVersion();
	const [osType = "darwin", arch = "arm64"] = platform.split("/");
	return {
		"User-Agent": `antigravity/hub/${resolved} (aidev_client; os_type=${osType}; arch=${arch}; cl=${AGY_HUB_CHANGELIST})`,
		"X-Goog-Api-Client": data.sdkClients[0] ?? "",
		clientMetadata: {
			ideType: data.ideTypes[0] ?? "ANTIGRAVITY",
			ideVersion: resolved,
			platform: AGY_PLATFORM_ENUM
		}
	};
}
/**
* Rewrite the version inside a fingerprint UA; reports whether it changed.
*
* Carries the metadata message's `ideVersion` along: they state the same fact,
* and letting them drift is how one account comes to look like two clients.
*/
function updateFingerprintVersion(fingerprint, version) {
	const match = fingerprint.userAgent.match(/^(antigravity\/(?:hub\/)?)([\d.]+)/);
	const uaChanged = match === null || match[1] !== "antigravity/hub/" || match[2] !== version;
	if (uaChanged) fingerprint.userAgent = `antigravity/hub/${version} (aidev_client; os_type=darwin; arch=arm64; cl=${AGY_HUB_CHANGELIST})`;
	const metaChanged = fingerprint.clientMetadata.ideVersion !== version;
	if (metaChanged) fingerprint.clientMetadata.ideVersion = version;
	return uaChanged || metaChanged;
}
/** Append a fingerprint to the account history (bounded), then use it as current. */
function recordFingerprintVersion(history, fingerprint, reason) {
	return [...history ?? [], {
		fingerprint,
		timestamp: Date.now(),
		reason
	}].slice(-5);
}
//#endregion
//#region src/runtime/risk.ts
const TRUE_VALUES = /* @__PURE__ */ new Set([
	"1",
	"true",
	"yes",
	"on"
]);
function envFlag(name) {
	const value = process.env[name];
	return value !== void 0 && TRUE_VALUES.has(value.trim().toLowerCase());
}
/** Global kill switch: DSH_AGY_DISABLE=1 keeps the plugin from registering anything. */
function isAgyDisabled() {
	return envFlag("DSH_AGY_DISABLE");
}
/**
* Fingerprint strategy: `dynamic` (default, identity regenerated after repeated
* rate-limits) or `stable` (one identity per account, never regenerated —
* mirrors OMP's fixed-client posture). Only the regeneration step differs; both
* modes present a single fixed identity when no fingerprint exists yet.
*/
function fingerprintMode() {
	return process.env.DSH_AGY_FINGERPRINT_MODE === "stable" ? "stable" : "dynamic";
}
/**
* Fraction-per-hour per window bucket, from two snapshots.
*
* Pure and exported for a direct unit test. Rules:
* - the FIRST sample yields nothing (no baseline yet), and so does a pair
*   closer than `MIN_BURN_SAMPLE_MS` — two probes seconds apart measure the
*   probe jitter, not the burn;
* - a RISING fraction is a reset (or refresh noise), never negative burn;
* - a bucket with no baseline simply has no rate yet.
*
* Returns null when no bucket produced a rate, so the caller can keep the
* previous rates instead of overwriting them with an empty read.
*/
function sampleLimitBurn(prev, next) {
	if (prev === void 0) return null;
	const elapsedH = (next.at - prev.at) / 36e5;
	if (elapsedH < 3e5 / 36e5) return null;
	const perHour = {};
	for (const [bucketId, fraction] of Object.entries(next.fractions)) {
		const before = prev.fractions[bucketId];
		if (before !== void 0 && before > fraction) perHour[bucketId] = (before - fraction) / elapsedH;
	}
	return Object.keys(perHour).length > 0 ? perHour : null;
}
/**
* Resolve the impersonation headers for one request from the account's
* persistent fingerprint (stable identity).
*
* The fallback below is only reachable when an account has no stored identity —
* normal operation creates one on first use (see `getSession`). It is therefore
* deliberately DETERMINISTIC rather than randomized: a per-request platform or
* version would make one account appear to be several different machines, which
* is the anomaly this identity exists to avoid. It reads
* {@link getFingerprintData} so a `$DSH_HOME/agy/agy-fingerprint-data.json` override
* still applies on this path.
*/
/** Whether a specific account is known to support the requested model. */
function isModelSupportedByAccount(account, model) {
	if (!model || !account.cachedModels || account.cachedModels.length === 0) return true;
	if (account.cachedModels.includes(model)) return true;
	const tieredMatch = /^(.*)-tiered$/.exec(model);
	if (tieredMatch) {
		const base = tieredMatch[1];
		if (account.cachedModels.some((m) => m === model || m.startsWith(base + "-"))) return true;
	}
	const levelMatch = /^(.*)-(?:low|medium|high)$/.exec(model);
	if (levelMatch) {
		const base = levelMatch[1];
		if (account.cachedModels.some((m) => m === model || m === `${base}-tiered` || m.startsWith(base + "-"))) return true;
	}
	return false;
}
function impersonationHeadersFor(account) {
	const fingerprint = account.fingerprint;
	if (fingerprint) return {
		"User-Agent": fingerprint.userAgent,
		"X-Goog-Api-Client": fingerprint.apiClient,
		clientMetadata: fingerprint.clientMetadata
	};
	return getStableHeaders(getFingerprintData(), currentAgyVersion());
}
var AgySessionManager = class AgySessionManager {
	store;
	onRotate;
	onHealthReport;
	recordUsageOption;
	tokenCache = /* @__PURE__ */ new Map();
	/** In-flight refresh promises keyed by account: concurrent requests share one refresh. */
	refreshInFlight = /* @__PURE__ */ new Map();
	/** In-flight quota fetches keyed by account: concurrent selections share one fetchAvailableModels call. */
	quotaRefreshInFlight = /* @__PURE__ */ new Map();
	/**
	* In-flight `retrieveUserQuotaSummary` probes keyed by account.
	*
	* ONE promise per account per cycle, shared by BOTH consumers:
	* `refreshLimits` (display, writes `cachedLimits`) and `refreshQuotaCache`
	* (scheduling, writes `cachedQuota`). Since #48 both read the same endpoint for
	* the same account, so a stale account paid two round trips where one would
	* do; `quotaRefreshInFlight` de-duplicated only WITHIN the scheduling path.
	* Sharing makes the two caches agree on what upstream actually said.
	*
	* It carries the FETCH and nothing else: the invariant that `refreshLimits`
	* must never write `cachedQuota` (which `rankPoolCandidates` turns into a
	* `blockedUntil`) is about WHERE a result lands, and each path still decides
	* that for itself.
	*/
	quotaSummaryInFlight = /* @__PURE__ */ new Map();
	failureCounts = /* @__PURE__ */ new Map();
	/** Accounts whose request-time project discovery already failed (no retry per request). */
	projectRetryFailed = /* @__PURE__ */ new Set();
	/** Bound for one quota poll so selection never stalls on a hung endpoint. */
	static QUOTA_FETCH_TIMEOUT_MS = 3e3;
	/** Refresh the token this far ahead of expiry so a request never blocks on the token endpoint. */
	static REFRESH_SKEW_MS = 12e4;
	/**
	* Per-conversation account affinity: the account one conversation is pinned
	* to, so its turns stay together (upstream prefix cache + `sessionId`
	* continuity) instead of re-ranking per request.
	*
	* Keyed by the conversation — `GenerateOptions.sessionId`, which the DSH agent
	* loop stamps — rather than by a single "last used" slot. That slot was a
	* stand-in for a conversation id the code assumed DSH did not expose, and with
	* two concurrent conversations the second overwrote the first's pin, so both
	* drifted across the pool independently of which account they started on.
	* Entries expire after {@link SESSION_AFFINITY_WINDOW_MS}.
	*/
	affinity = /* @__PURE__ */ new Map();
	/** Bound on tracked conversations; least-recently-pinned entries are evicted. */
	static MAX_AFFINITY_ENTRIES = 64;
	/** Bucket for callers with no session identity (standalone CLI, one-shots). */
	static ANONYMOUS_CONVERSATION = "\0anonymous";
	/**
	* In-flight upstream requests per account, so selection can spread concurrent
	* fan-out across the pool instead of stacking every stream on one account.
	*
	* Deliberately a PREFERENCE, not a hard gate: when every eligible account is at
	* the cap, selection proceeds with the best-ranked one rather than waiting.
	* Blocking would need a reliable release on every path (including an abandoned
	* stream) and a bounded wait to avoid deadlock, and a leaked counter would then
	* stall real requests — a worse failure than the burst it prevents. The
	* documented limitation is therefore: this spreads load across a multi-account
	* pool, and cannot throttle a single-account one.
	*/
	inFlight = /* @__PURE__ */ new Map();
	/** In-flight count for one account, discarding a leaked entry past its TTL. */
	inFlightCount(accountKey, now) {
		const entry = this.inFlight.get(accountKey);
		if (entry === void 0) return 0;
		if (now - entry.at > 6e5) {
			this.inFlight.delete(accountKey);
			return 0;
		}
		return entry.count;
	}
	/** Record that one upstream request for this account has started. */
	noteRequestStarted(account) {
		const key = this.accountKey(account);
		const now = Date.now();
		this.inFlight.set(key, {
			count: this.inFlightCount(key, now) + 1,
			at: now
		});
	}
	/** Record that one upstream request for this account has settled, on any path. */
	noteRequestSettled(account) {
		const key = this.accountKey(account);
		const now = Date.now();
		const count = this.inFlightCount(key, now);
		if (count <= 1) this.inFlight.delete(key);
		else this.inFlight.set(key, {
			count: count - 1,
			at: now
		});
	}
	/**
	* Which accounts have upstream requests in flight, for the UI's live line.
	*
	* The join runs HERE, not in the RPC layer: the in-flight map is keyed by
	* `accountKey` (id ?? email ?? idx-<refresh>), a derivation the management
	* surface must not have to replicate — its own email-first key would miss
	* every account carrying both fields. Counts go through `inFlightCount`, so
	* an entry leaked past its TTL reads as idle instead of busy forever.
	*/
	async inFlightAccounts() {
		const storage = await this.store.load();
		const now = Date.now();
		const busy = [];
		for (const [index, account] of storage.accounts.entries()) {
			const count = this.inFlightCount(this.accountKey(account), now);
			if (count > 0) busy.push({
				index,
				email: account.email ?? null,
				count
			});
		}
		return busy;
	}
	/** Last fraction snapshot per account, for `sampleLimitBurn` (memory only). */
	limitFractions = /* @__PURE__ */ new Map();
	/** Latest burn rate per account: bucketId -> fraction/hour (memory only). */
	limitBurn = /* @__PURE__ */ new Map();
	noteLimitSample(key, groups, at) {
		const fractions = {};
		for (const group of groups) for (const window of group.windows) if (window.remainingFraction !== null) fractions[window.bucketId] = window.remainingFraction;
		const next = {
			at,
			fractions
		};
		const burn = sampleLimitBurn(this.limitFractions.get(key), next);
		if (burn !== null) this.limitBurn.set(key, { perHour: burn });
		this.limitFractions.set(key, next);
	}
	/**
	* Burn rates per account INDEX, for the `account.limits` reply.
	*
	* The index join runs here, like `inFlightAccounts`: the rate map is keyed
	* by `accountKey`, a derivation the management surface must not replicate.
	*/
	async limitBurnRates() {
		const storage = await this.store.load();
		const out = [];
		for (const [index, account] of storage.accounts.entries()) {
			const entry = this.limitBurn.get(this.accountKey(account));
			if (entry !== void 0) out.push({
				index,
				perHour: entry.perHour
			});
		}
		return out;
	}
	/** The map key for a conversation; anonymous callers share one bucket. */
	conversationKeyFor(conversationKey) {
		const trimmed = conversationKey?.trim();
		return trimmed && trimmed.length > 0 ? trimmed : AgySessionManager.ANONYMOUS_CONVERSATION;
	}
	/** Drop expired pins and keep the map bounded. */
	pruneAffinity(now) {
		for (const [conversation, pin] of this.affinity) if (now - pin.at >= 6e5) this.affinity.delete(conversation);
		while (this.affinity.size > AgySessionManager.MAX_AFFINITY_ENTRIES) {
			const oldest = this.affinity.keys().next();
			if (oldest.done) break;
			this.affinity.delete(oldest.value);
		}
	}
	/** The account key this conversation is pinned to, when the pin is still fresh. */
	affinityFor(conversationKey, now) {
		const pin = this.affinity.get(this.conversationKeyFor(conversationKey));
		if (!pin || now - pin.at >= 6e5) return null;
		return pin.key;
	}
	/** Pin one conversation to one account. Re-inserts so eviction stays LRU. */
	setAffinity(conversationKey, accountKey, now) {
		const conversation = this.conversationKeyFor(conversationKey);
		this.affinity.delete(conversation);
		this.affinity.set(conversation, {
			key: accountKey,
			at: now
		});
		this.pruneAffinity(now);
	}
	/**
	* Drop every pin pointing at one account.
	*
	* A rotation or a skip means the account just proved unusable for the
	* conversation that was pinned to it; other conversations pinned elsewhere keep
	* their pins, which the single-slot version could not express.
	*/
	clearAffinityForAccount(accountKey) {
		for (const [conversation, pin] of this.affinity) if (pin.key === accountKey) this.affinity.delete(conversation);
	}
	/**
	* Clear all session affinity pins.
	*
	* Called when an account is explicitly activated by the user, so all
	* ongoing and upcoming conversations immediately steer to the newly
	* activated account rather than staying pinned to the previous one.
	*/
	clearAllAffinity() {
		this.affinity.clear();
	}
	/**
	* Explicitly activate an account by index: sets `storage.activeIndex = index`,
	* clears session affinity pins so conversations immediately switch to the
	* activated account, and resets transient failure counts.
	*/
	async activateAccount(index) {
		await this.store.mutate((storage) => {
			if (index < 0 || index >= storage.accounts.length) throw new Error("account not found");
			storage.activeIndex = index;
		});
		this.clearAllAffinity();
	}
	constructor(options) {
		this.store = options.store;
		this.onRotate = options.onRotate;
		this.onHealthReport = options.onHealthReport;
		this.recordUsageOption = options.recordUsage;
	}
	/** Emit one non-chat usage record; a ledger failure never breaks the call. */
	emitUsage(record) {
		try {
			this.recordUsageOption?.(record);
		} catch {}
	}
	accountKey(account) {
		return account.id ?? account.email ?? `idx-${account.refresh}`;
	}
	/**
	* Refresh the account's access token (single-flight per account). A transient
	* refresh failure keeps the cached token in place (retain-last-good): the old
	* token stays valid until its own expiry and a later request retries the
	* refresh. Only `invalid_grant` drops the cache.
	*/
	refreshToken(key, account, cached) {
		const inFlight = this.refreshInFlight.get(key);
		if (inFlight) return inFlight;
		const refreshing = (async () => {
			const result = await refreshAccessToken({
				access: cached?.access ?? "",
				expires: cached?.expires ?? 0,
				refresh: account.refresh
			}, {
				clientId: account.clientId,
				proxyUrl: account.proxy
			});
			if (result.type === "success") {
				if (!account.clientId && result.clientId) {
					await this.store.mutate((s) => {
						const target = s.accounts.find((candidate) => this.accountKey(candidate) === key);
						if (!target) throw new Error(`Account ${key} not found during clientId migration`);
						target.clientId = result.clientId;
					});
					account.clientId = result.clientId;
				}
				this.tokenCache.set(key, {
					access: result.auth.access,
					expires: result.auth.expires
				});
				return result.auth;
			}
			if (result.type === "failed") {
				if (cached && !accessTokenExpired({
					access: cached.access,
					expires: cached.expires,
					refresh: account.refresh
				})) return {
					access: cached.access,
					expires: cached.expires,
					refresh: account.refresh
				};
				if (account.proxy && isProxyUnreachableError(result.error)) throw new AgyAuthError("transport", "proxy_unreachable", { cause: result.error });
				const kind = result.error.status === 429 ? "rate-limit" : result.error.status === 0 || result.error.status === 408 || result.error.status >= 500 ? "transport" : "invalid-credential";
				throw new AgyAuthError(kind, describeFetchError(result.error), { cause: result.error });
			}
			if (result.type === "revoked") {
				this.tokenCache.delete(key);
				await this.store.mutate((s) => {
					const target = s.accounts.find((candidate) => this.accountKey(candidate) === key);
					if (target) {
						target.enabled = false;
						target.verificationRequired = true;
						target.verificationRequiredAt = Date.now();
						target.verificationRequiredReason = "auth-failure";
					}
				});
				account.enabled = false;
				account.verificationRequired = true;
				account.verificationRequiredAt = Date.now();
				account.verificationRequiredReason = "auth-failure";
				return;
			}
		})();
		this.refreshInFlight.set(key, refreshing);
		refreshing.then(() => this.refreshInFlight.delete(key), () => this.refreshInFlight.delete(key));
		return refreshing;
	}
	/** Resolve a usable access token for the account, pre-emptively refreshing near expiry. */
	async accessTokenFor(account) {
		const key = this.accountKey(account);
		const cached = this.tokenCache.get(key);
		const now = Date.now();
		if (cached && !accessTokenExpired({
			access: cached.access,
			expires: cached.expires,
			refresh: account.refresh
		})) {
			if (cached.expires <= now + AgySessionManager.REFRESH_SKEW_MS) this.refreshToken(key, account, cached);
			return {
				access: cached.access,
				expires: cached.expires,
				refresh: account.refresh
			};
		}
		return this.refreshToken(key, account, cached);
	}
	/**
	* Probe `retrieveUserQuotaSummary` for one account, sharing ONE in-flight
	* promise with every other caller in this cycle.
	*
	* Returns `[]` on any failure — the fetch itself already answers a dead
	* endpoint with an empty list — so both consumers read "no groups" the same
	* way. The promise is dropped as soon as it settles, so the NEXT cycle
	* re-probes.
	*
	* The account's proxy is honoured here or the call would egress direct and
	* leak the account's real IP, and one timeout bounds the whole endpoint
	* fallback chain.
	*/
	probeQuotaSummary(account) {
		const key = this.accountKey(account);
		const existing = this.quotaSummaryInFlight.get(key);
		if (existing) return existing;
		const probe = (async () => {
			try {
				const auth = await this.accessTokenFor(account);
				if (!auth) return [];
				const { fetchQuotaSummary } = await import("./quota-summary-qOSOvtdc.mjs");
				const routed = accountFetch({ proxyUrl: account.proxy });
				const bounded = (input, init) => {
					const timeout = AbortSignal.timeout(AgySessionManager.QUOTA_FETCH_TIMEOUT_MS);
					const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
					return routed(input, {
						...init,
						signal
					});
				};
				return await fetchQuotaSummary(auth.access, account.projectId, bounded);
			} catch {
				return [];
			}
		})();
		this.quotaSummaryInFlight.set(key, probe);
		const release = () => {
			if (this.quotaSummaryInFlight.get(key) === probe) this.quotaSummaryInFlight.delete(key);
		};
		probe.then(release, release);
		return probe;
	}
	/**
	* Refresh the display-only 5h/weekly windows for every enabled account.
	*
	* SEPARATE from `refreshQuotaCache`, and deliberately so. That method writes
	* `cachedQuota`, which feeds the scheduling path: `rankPoolCandidates` turns a
	* measured `remainingFraction <= 0` into a `blockedUntil`, so measuring a
	* pool's quota can BLOCK an account. That is safe only with a fallback, which
	* is why `getSession` gates it on `eligible.length > 1` — and that gate is also
	* why a solo account never had `cachedLimits` populated and the limits card
	* showed "not measured yet" forever.
	*
	* Dropping the gate instead would have been a real outage, not a display fix:
	* a solo account whose family is measured at 0 gets `AgyPoolBlockedError` with
	* no other account to serve the request (verified). So the windows are fetched
	* here WITHOUT writing `cachedQuota`, which makes them safe to measure for a
	* pool of any size — a solo account included.
	*
	* Cost is bounded by the same TTL the scheduling path uses, so this runs at
	* most once per window rather than per request.
	*
	* KNOWN LIMITATION (deliberate, not overlooked): a FAILED probe writes no
	* marker, so "probe failed" and "never probed" are indistinguishable and
	* `isLimitsStale` reports stale again on the next call. The practical effect is
	* that an account whose endpoint never returns groups is re-probed each time
	* the accounts page is opened, with no backoff. Acceptable today — the call is
	* display-only, TTL-bounded, and triggered by opening a tab rather than by a
	* poll — so no negative-TTL field is added yet. Revisit if the trigger becomes
	* frequent or the pool grows enough that the extra calls matter.
	*
	* @param storage - the loaded storage document, overlaid in memory on success.
	* @param options - `force` re-probes inside the TTL.
	* @returns which accounts were measured, so a caller that asked for a refresh
	*   can REPORT it. Without this a forced refresh that failed was completely
	*   silent: no cache write, no `updatedAt` change, nothing on screen — the
	*   same "clicked it, saw a flicker" defect as an unread RPC verdict.
	*/
	async refreshLimits(storage, options = {}) {
		const now = Date.now();
		const candidates = storage.accounts.filter((account) => account.enabled !== false);
		const targets = options.force === true ? candidates : candidates.filter((account) => isLimitsStale(account, now));
		if (targets.length === 0) return {
			measured: [],
			failed: [],
			skipped: candidates.length
		};
		const probes = await Promise.all(targets.map(async (account) => {
			const key = this.accountKey(account);
			try {
				const groups = await this.probeQuotaSummary(account);
				if (groups.length === 0) return {
					key,
					ok: false
				};
				return {
					key,
					ok: true,
					groups,
					updatedAt: Date.now()
				};
			} catch {
				return {
					key,
					ok: false
				};
			}
		}));
		const updates = probes.filter((probe) => probe.ok);
		const failed = probes.filter((probe) => !probe.ok).map((probe) => probe.key);
		const result = {
			measured: updates.map((update) => update.key),
			failed,
			skipped: candidates.length - targets.length
		};
		if (updates.length === 0) return result;
		for (const update of updates) {
			const target = storage.accounts.find((candidate) => this.accountKey(candidate) === update.key);
			if (target) {
				target.cachedLimits = {
					groups: update.groups,
					updatedAt: update.updatedAt
				};
				this.noteLimitSample(update.key, update.groups, update.updatedAt);
			}
		}
		const live = new Set(storage.accounts.map((account) => this.accountKey(account)));
		for (const key of this.limitFractions.keys()) if (!live.has(key)) this.limitFractions.delete(key);
		for (const key of this.limitBurn.keys()) if (!live.has(key)) this.limitBurn.delete(key);
		try {
			await this.store.mutate((s) => {
				for (const update of updates) {
					const target = s.accounts.find((candidate) => this.accountKey(candidate) === update.key);
					if (target) target.cachedLimits = {
						groups: update.groups,
						updatedAt: update.updatedAt
					};
				}
			});
		} catch {}
		return result;
	}
	/**
	* Refresh stale per-account quota caches (family-scoped, health-based TTL).
	* Failures leave the account unmeasured: ranking treats it as a fallback
	* instead of blocking selection on a hung endpoint.
	*/
	async refreshQuotaCache(storage) {
		const now = Date.now();
		const stale = storage.accounts.filter((account) => account.enabled !== false && isQuotaStale(account, now));
		if (stale.length === 0) return;
		const updates = (await Promise.all(stale.map(async (account) => {
			const key = this.accountKey(account);
			if (this.quotaRefreshInFlight.has(key)) return this.quotaRefreshInFlight.get(key);
			const refresh = (async () => {
				try {
					const auth = await this.accessTokenFor(account);
					if (!auth) return null;
					const { fetchAvailableModels } = await import("./models-ev8NAQa3.mjs").then((n) => n.r);
					const routed = accountFetch({ proxyUrl: account.proxy });
					const bounded = (input, init) => {
						const timeout = AbortSignal.timeout(AgySessionManager.QUOTA_FETCH_TIMEOUT_MS);
						const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
						return routed(input, {
							...init,
							signal
						});
					};
					const [discovered, groups] = await Promise.all([fetchAvailableModels(auth.access, account.projectId, bounded), this.probeQuotaSummary(account)]);
					const quotas = ingestFamilyQuotas(discovered, groups, account.cachedQuota);
					const models = Object.keys(discovered.models ?? {});
					return {
						key,
						quotas,
						models,
						updatedAt: Date.now()
					};
				} catch {
					return null;
				}
			})();
			this.quotaRefreshInFlight.set(key, refresh);
			try {
				return await refresh;
			} finally {
				this.quotaRefreshInFlight.delete(key);
			}
		}))).filter((r) => Boolean(r && Object.keys(r.quotas).length > 0));
		if (updates.length > 0) {
			for (const update of updates) {
				const target = storage.accounts.find((candidate) => this.accountKey(candidate) === update.key);
				if (target) {
					target.cachedQuota = update.quotas;
					target.cachedQuotaUpdatedAt = update.updatedAt;
					if (update.models.length > 0) target.cachedModels = update.models;
				}
			}
			try {
				await this.store.mutate((s) => {
					for (const update of updates) {
						const target = s.accounts.find((candidate) => this.accountKey(candidate) === update.key);
						if (target) {
							target.cachedQuota = update.quotas;
							target.cachedQuotaUpdatedAt = update.updatedAt;
							if (update.models.length > 0) target.cachedModels = update.models;
						}
					}
				});
			} catch {}
		}
	}
	/**
	* Pick the account for one request: the affinity pin wins while it is fresh,
	* healthy, and not quota-exhausted for the requested model; the explicitly
	* activated account wins next while it is usable; otherwise the pool is
	* ranked by family-scoped usage (OMP-aligned) and the best candidate wins.
	*/
	async pickAccount(storage, model, conversationKey) {
		const now = Date.now();
		for (const account of storage.accounts) clearExpiredState(account, now);
		const family = modelFamilyOf(model);
		const familyKey = familyKeyOf(model);
		const pinnedKey = this.affinityFor(conversationKey, now);
		if (pinnedKey !== null) {
			const lastIndex = storage.accounts.findIndex((a) => this.accountKey(a) === pinnedKey);
			if (lastIndex !== -1) {
				const last = storage.accounts[lastIndex];
				if (last.enabled !== false && isModelSupportedByAccount(last, model) && !isCoolingDown(last, now) && !isFamilyRateLimited(last, familyKey, now) && !isFamilyQuotaExhausted(last, family, now)) return {
					account: last,
					index: lastIndex
				};
			}
		}
		const eligible = storage.accounts.map((account, index) => ({
			account,
			index
		})).filter(({ account }) => account.enabled !== false && isModelSupportedByAccount(account, model));
		if (eligible.length === 0) return void 0;
		const active = storage.accounts[storage.activeIndex];
		const isActiveUsable = (acc) => acc !== void 0 && acc.enabled !== false && isModelSupportedByAccount(acc, model) && !isCoolingDown(acc, now) && !isFamilyRateLimited(acc, familyKey, now) && !isFamilyQuotaExhausted(acc, family, now);
		if (isActiveUsable(active) && this.inFlightCount(this.accountKey(active), now) < 3) return {
			account: active,
			index: storage.activeIndex
		};
		const ranked = rankPoolCandidates(eligible, model, now, storage.activeIndex);
		const picked = ranked.find((candidate) => candidate.blockedUntil === null && this.inFlightCount(this.accountKey(candidate.account), now) < 3) ?? ranked.find((candidate) => candidate.blockedUntil === null);
		if (!picked) {
			const quotaExhausted = (account) => {
				if (account.cooldownReason === "quota-exhausted" && (account.coolingDownUntil ?? 0) > now) return true;
				const quota = familyQuotaFor(account, family, now);
				if (!quota) return false;
				const spent = (fraction, resetTime) => {
					if (typeof fraction !== "number" || fraction > 0 || !resetTime) return false;
					const resetAt = Date.parse(resetTime);
					return !Number.isNaN(resetAt) && resetAt > now;
				};
				return spent(quota.remainingFraction, quota.resetTime) || spent(quota.weeklyFraction, quota.weeklyResetTime);
			};
			const retryable = ranked.filter((candidate) => !quotaExhausted(candidate.account));
			const blocked = retryable.length > 0 ? retryable : ranked;
			const blockedUntil = Math.min(...blocked.map((candidate) => candidate.blockedUntil ?? now));
			throw new AgyPoolBlockedError(retryable.length > 0 ? "retryable" : "quota-exhausted", blockedUntil);
		}
		if (picked.index !== storage.activeIndex) {
			storage.activeIndex = picked.index;
			await this.store.mutate((s) => {
				s.activeIndex = picked.index;
			});
		}
		return {
			account: picked.account,
			index: picked.index
		};
	}
	/**
	* Adapter hook: resolve the active session (refresh if needed), healing a
	* missing projectId at request time — the OAuth-time loadCodeAssist may have
	* transiently failed even when the Google account owns a Cloud Code project
	* (mirrors OmniRoute's ensureAntigravityProjectAssigned + persistence).
	* @param model - requested model id; drives family-scoped quota ranking.
	* @param accountIndex - resolve this exact account instead of ranking the pool.
	*   Used by the management "Test call" action, where testing a different
	*   account than the one the user clicked would report a result for the wrong
	*   account. Deliberately does NOT update the affinity pin: a one-shot test
	*   must not steer the next real conversation onto the account it probed.
	* @param conversationKey - the conversation's identity (`GenerateOptions.sessionId`),
	*   which scopes account affinity. Concurrent conversations therefore hold
	*   independent pins. Omitted by callers with no conversation (CLI, probes),
	*   which share one anonymous bucket.
	*/
	async getSession(model, accountIndex, conversationKey) {
		let storage = await this.store.load();
		if (accountIndex !== void 0) {
			const account = storage.accounts[accountIndex];
			if (!account) throw new Error(`account #${accountIndex} not found`);
			if (account.enabled === false) throw new Error(`account #${accountIndex} is disabled`);
		}
		const maxAttempts = accountIndex === void 0 ? storage.accounts.filter((account) => account.enabled !== false).length : 1;
		let proxyUnreachableCount = 0;
		/**
		* Last transport failure seen on a *proxyless* account. Such an account is
		* skipped (another enabled account may be healthy) without writing a
		* cooldown: a cooldown would surface as AgyPoolBlockedError — i.e. RATE_LIMIT
		* for a plain network error — and would block a solo pool outright. It is
		* remembered so the request still reports its real cause rather than
		* degrading into "no account configured" when every account fails this way.
		*/
		let lastTransportError;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const eligible = storage.accounts.filter((account) => account.enabled !== false);
			if (accountIndex === void 0 && eligible.length > 1) await this.refreshQuotaCache(storage);
			const picked = accountIndex === void 0 ? await this.pickAccount(storage, model, conversationKey) : (() => {
				const account = storage.accounts[accountIndex];
				if (!account) throw new Error(`account #${accountIndex} not found`);
				if (account.enabled === false) throw new Error(`account #${accountIndex} is disabled`);
				return {
					account,
					index: accountIndex
				};
			})();
			if (!picked) return void 0;
			let auth;
			try {
				auth = await this.accessTokenFor(picked.account);
			} catch (error) {
				if (Boolean(picked.account.proxy) && isProxyUnreachableError(error)) {
					proxyUnreachableCount++;
					if (accountIndex !== void 0) throw error;
					storage = await this.skipAccount(storage, picked.account);
					continue;
				}
				lastTransportError = error;
				if (accountIndex !== void 0) throw error;
				storage = await this.skipAccount(storage, picked.account);
				continue;
			}
			if (!auth) {
				if (accountIndex !== void 0) throw new Error(`account #${accountIndex} credential is no longer valid — run \`dsh-agy login\``);
				this.clearAffinityForAccount(this.accountKey(picked.account));
				storage = await this.store.load();
				continue;
			}
			const key = this.accountKey(picked.account);
			if (!picked.account.projectId && !this.projectRetryFailed.has(key)) try {
				const { loadCodeAssist } = await import("./exchange-mjEsIwkU.mjs").then((n) => n.n);
				const { projectId } = await loadCodeAssist(auth.access, { proxyUrl: picked.account.proxy });
				if (projectId) {
					await this.store.mutate((s) => {
						const account = s.accounts.find((candidate) => this.accountKey(candidate) === key);
						if (account) {
							account.projectId = projectId;
							const parts = parseRefreshParts(account.refresh);
							account.refresh = formatRefreshParts({
								refreshToken: parts.refreshToken,
								projectId,
								managedProjectId: parts.managedProjectId
							});
						}
					});
					picked.account.projectId = projectId;
				} else this.projectRetryFailed.add(key);
			} catch {
				this.projectRetryFailed.add(key);
			}
			if (!picked.account.fingerprint) {
				const fingerprint = generateFingerprint(void 0, currentAgyVersion());
				const history = recordFingerprintVersion(picked.account.fingerprintHistory, fingerprint, "initial");
				await this.store.mutate((s) => {
					const account = s.accounts.find((candidate) => this.accountKey(candidate) === key);
					if (account && !account.fingerprint) {
						account.fingerprint = fingerprint;
						account.fingerprintHistory = history;
					}
				});
				picked.account.fingerprint = fingerprint;
				picked.account.fingerprintHistory = history;
			}
			if (accountIndex === void 0) this.setAffinity(conversationKey, key, Date.now());
			return {
				auth,
				account: picked.account,
				index: picked.index,
				impersonation: impersonationHeadersFor(picked.account)
			};
		}
		if (proxyUnreachableCount === maxAttempts && maxAttempts > 0) throw new AgyAuthError("transport", "proxy_unreachable");
		if (lastTransportError !== void 0) throw lastTransportError;
	}
	/**
	* Drop the session pin and move the pool cursor off an account that just
	* failed, so the next `pickAccount` in this same request tries another one.
	* State on the account itself is deliberately left untouched (no cooldown).
	*/
	async skipAccount(storage, account) {
		this.clearAffinityForAccount(this.accountKey(account));
		const key = this.accountKey(account);
		const deadIndex = storage.accounts.findIndex((candidate) => this.accountKey(candidate) === key);
		if (deadIndex !== -1) {
			const next = pickNextAccountIndex(storage.accounts, deadIndex, Date.now());
			if (next !== storage.activeIndex) {
				storage.activeIndex = next;
				await this.store.mutate((s) => {
					s.activeIndex = next;
				}).catch(() => {});
			}
		}
		return this.store.load();
	}
	/** Adapter hook: apply rotation decisions and fingerprint regeneration. */
	async reportFailure(kind, session, info) {
		if (!session?.account) return;
		const key = this.accountKey(session.account);
		const consecutive = (this.failureCounts.get(key) ?? 0) + 1;
		this.failureCounts.set(key, consecutive);
		let nextIndexToRotate = null;
		const fpCachedVersion = kind === "rate-limit" ? peekCachedAntigravityVersion() : null;
		const fpResolvedVersion = kind === "rate-limit" ? fpCachedVersion ?? await resolveAntigravityVersionBounded(750, probeFetch(session.account.proxy)) ?? currentAgyVersion() : currentAgyVersion();
		await this.store.mutate((storage) => {
			const account = storage.accounts.find((a) => this.accountKey(a) === key);
			if (!account) return;
			const decision = decideRotation(kind, account, consecutive, info?.retryAfterMs, info?.rateLimitCategory, info?.resetTime);
			if (kind === "verification-required" && info?.verificationUrl) account.verificationUrl = info.verificationUrl;
			if (kind === "rate-limit" && info?.rateLimitCategory !== "soft_rate_limit") recordRateLimit(account, familyKeyOf(info?.model), parseFutureResetMs$1(info?.resetTime, Date.now()) ?? Date.now() + Math.min(info?.retryAfterMs ?? 3e5, 18e5));
			if (decision.action === "revoke") {
				this.tokenCache.delete(key);
				this.failureCounts.delete(key);
				const currentIndex = storage.accounts.findIndex((a) => this.accountKey(a) === key);
				const nextIndex = pickNextAccountIndex(storage.accounts, currentIndex >= 0 ? currentIndex : storage.activeIndex, Date.now());
				if (nextIndex !== storage.activeIndex) {
					storage.activeIndex = nextIndex;
					nextIndexToRotate = nextIndex;
				}
				this.clearAffinityForAccount(key);
				return;
			}
			if (kind === "rate-limit" && info?.rateLimitCategory !== "soft_rate_limit") {
				if (!account.fingerprint) {
					account.fingerprint = generateFingerprint(void 0, fpResolvedVersion);
					account.fingerprintHistory = recordFingerprintVersion(account.fingerprintHistory, account.fingerprint, "initial");
				} else {
					if (fpCachedVersion) updateFingerprintVersion(account.fingerprint, fpCachedVersion);
					if (fingerprintMode() !== "stable" && consecutive >= 2) {
						const fresh = generateFingerprint(void 0, fpResolvedVersion);
						account.fingerprintHistory = recordFingerprintVersion(account.fingerprintHistory, fresh, "regenerated");
						account.fingerprint = fresh;
					}
				}
			}
			if (decision.action === "rotate" || decision.action === "cool") {
				const currentIndex = storage.accounts.findIndex((a) => this.accountKey(a) === key);
				const familyKey = familyKeyOf(info?.model);
				const nextIndex = pickNextAccountIndex(storage.accounts, currentIndex >= 0 ? currentIndex : storage.activeIndex, Date.now(), familyKey);
				if (nextIndex !== storage.activeIndex) {
					storage.activeIndex = nextIndex;
					nextIndexToRotate = nextIndex;
				}
				this.clearAffinityForAccount(key);
			}
		});
		if (nextIndexToRotate !== null) {
			this.onRotate?.(session.index, nextIndexToRotate, kind);
			this.emitUsage({
				...session.account.email === void 0 && session.account.id === void 0 ? {} : { account: session.account.email ?? session.account.id },
				source: "chat",
				ok: false,
				rotated: true,
				poolEvent: true,
				reason: kind
			});
		}
	}
	/** Adapter hook: reset the failure counter after a clean completion. */
	async markSuccess(session) {
		const account = session.account;
		const key = this.accountKey(account);
		this.failureCounts.delete(key);
	}
	/**
	* Test call: one short streaming request against the live backend.
	* Returns the collected text or a structured error message.
	* @param model - model id to exercise.
	* @param options - probe overrides.
	*   - `prompt` / `maxTokens`: the request shape (defaults to a one-token reply).
	*   - `accountIndex`: test this exact account instead of letting the pool rank
	*     one. The management UI exposes "Test call" per account row, so without
	*     this the probe ran on whichever account affinity picked, and its result
	*     was both returned and recorded against that other account.
	*/
	async testCall(model, options = {}) {
		const prompt = options.prompt ?? "Reply with exactly: OK";
		const maxTokens = options.maxTokens ?? 1024;
		const startedAt = Date.now();
		let session;
		try {
			session = await this.getSession(model, options.accountIndex);
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
		if (!session) return {
			ok: false,
			error: "No agy account configured — run `dsh-agy login` first."
		};
		try {
			const account = session.account.email ?? session.account.id;
			const { toAgyRequestBody } = await import("./translate-z9iY0k3O.mjs").then((n) => n.n);
			const { fetchAgyFirstOk } = await import("./constants-BboCQZJG.mjs").then((n) => n.p);
			const { parseAgySse } = await import("./parse-BFsVTalF.mjs").then((n) => n.i);
			const requestId = generateAntigravityRequestId();
			const body = toAgyRequestBody({
				provider: "agy",
				model,
				messages: [{
					id: "test-1",
					role: "user",
					content: [{
						type: "text",
						text: prompt
					}]
				}],
				maxTokens
			}, {
				projectId: session.account.projectId,
				sessionId: deriveAntigravitySessionId(session.account.email) ?? void 0,
				requestId
			});
			const headers = {
				authorization: `Bearer ${session.auth.access}`,
				"content-type": "application/json",
				accept: "text/event-stream",
				"User-Agent": session.impersonation["User-Agent"],
				"X-Goog-Api-Client": session.impersonation["X-Goog-Api-Client"]
			};
			const routing = {
				proxyUrl: session.account.proxy,
				streaming: true
			};
			const response = await fetchAgyFirstOk("/v1internal:streamGenerateContent?alt=sse", {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: options.signal
			}, accountFetch(routing), routing);
			if (!response.ok) {
				const text = await response.text().catch(() => "");
				this.emitUsage({
					account,
					model,
					source: "test",
					ok: false,
					latencyMs: Date.now() - startedAt
				});
				return {
					ok: false,
					error: `HTTP ${response.status}: ${text.slice(0, 300)}`
				};
			}
			if (!response.body) {
				this.emitUsage({
					account,
					model,
					source: "test",
					ok: false,
					latencyMs: Date.now() - startedAt
				});
				return {
					ok: false,
					error: "no response body"
				};
			}
			const text = [];
			let usage;
			let ttftMs;
			for await (const chunk of parseAgySse(response.body, {
				signal: options.signal,
				idleTimeoutMs: options.idleTimeoutMs
			})) if (chunk.type === "usage") usage = {
				input: chunk.usage.inputTokens,
				output: chunk.usage.outputTokens,
				cacheRead: chunk.usage.cacheReadTokens ?? 0,
				cacheWrite: chunk.usage.cacheWriteTokens ?? 0
			};
			else if (chunk.type === "text-delta") {
				if (ttftMs === void 0) ttftMs = Date.now() - startedAt;
				text.push(chunk.text);
			}
			const ok = text.length > 0;
			this.emitUsage({
				account,
				model,
				source: "test",
				ok,
				...usage === void 0 ? {} : { usage },
				...ttftMs === void 0 ? {} : { ttftMs },
				latencyMs: Date.now() - startedAt
			});
			return {
				ok,
				text: text.join(""),
				error: ok ? void 0 : "empty response"
			};
		} catch (error) {
			this.emitUsage({
				source: "test",
				ok: false,
				latencyMs: Date.now() - startedAt
			});
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/** Export one account as a paste-credential blob (for migration to another host). */
	async exportBlob(index) {
		const account = (await this.store.load()).accounts[index];
		if (!account) return { error: "account not found" };
		try {
			const auth = await this.accessTokenFor(account);
			if (!auth) return { error: "refresh failed (revoked?)" };
			const { encodeCredentialBlob } = await import("./blob-D1e7_uT1.mjs").then((n) => n.t);
			const parts = parseRefreshParts(account.refresh);
			return { blob: encodeCredentialBlob("agy", {
				access_token: auth.access,
				refresh_token: parts.refreshToken,
				expires_in: Math.max(0, Math.round((auth.expires - Date.now()) / 1e3))
			}) };
		} catch (error) {
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}
	/** Probe one account: refresh + userinfo; a live credential re-enables the account. */
	async probeAccount(index, account) {
		const startedAt = Date.now();
		const key = account.email ?? account.id;
		try {
			const auth = await this.accessTokenFor(account);
			if (!auth) {
				this.emitUsage({
					account: key,
					source: "verify",
					ok: false,
					latencyMs: Date.now() - startedAt
				});
				return {
					ok: false,
					error: "refresh failed (revoked?)"
				};
			}
			const response = await proxiedFetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", { headers: { Authorization: `Bearer ${auth.access}` } }, account.proxy ? { proxyUrl: account.proxy } : void 0);
			if (!response.ok) {
				this.emitUsage({
					account: key,
					source: "verify",
					ok: false,
					latencyMs: Date.now() - startedAt
				});
				return {
					ok: false,
					error: `userinfo ${response.status}`
				};
			}
			const info = await response.json();
			await this.store.mutate((s) => {
				const target = s.accounts[index];
				if (target) {
					target.enabled = true;
					target.verificationRequired = false;
					target.verificationRequiredAt = void 0;
					target.verificationRequiredReason = void 0;
					target.verificationUrl = void 0;
				}
			});
			this.emitUsage({
				account: info.email ?? key,
				source: "verify",
				ok: true,
				latencyMs: Date.now() - startedAt
			});
			return {
				ok: true,
				email: info.email
			};
		} catch (error) {
			this.emitUsage({
				account: key,
				source: "verify",
				ok: false,
				latencyMs: Date.now() - startedAt
			});
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/** CLI/web helper: verify an account's credentials (refresh + userinfo). */
	async verifyAccount(index) {
		const account = (await this.store.load()).accounts[index];
		if (!account) return {
			ok: false,
			error: "account not found"
		};
		return this.probeAccount(index, account);
	}
	/**
	* Batch health check over all enabled accounts (or the given indices):
	* refresh + userinfo per account, live credentials re-enable the account.
	* Reports results through onHealthReport when a listener is registered.
	*/
	async checkAccounts(indices) {
		const storage = await this.store.load();
		const targets = indices !== void 0 ? indices.filter((index) => storage.accounts[index]) : storage.accounts.map((_, index) => index).filter((index) => storage.accounts[index].enabled !== false);
		const results = await Promise.all(targets.map(async (index) => {
			return {
				index,
				...await this.probeAccount(index, storage.accounts[index])
			};
		}));
		this.onHealthReport?.(results);
		return results;
	}
	/**
	* Start a background health probe on an interval (disposable stop handle).
	* The timer is unref'd unless told otherwise so harness processes can still
	* exit; the CLI loop mode passes `unref: false`.
	*/
	startHealthProbe(intervalMs, options = {}) {
		if (!Number.isFinite(intervalMs) || intervalMs <= 0) return () => {};
		const timer = setInterval(() => {
			this.checkAccounts().catch(() => {});
		}, intervalMs);
		if (options.unref !== false) timer.unref?.();
		return () => clearInterval(timer);
	}
};
const ENC_PREFIX = "enc:v1:";
const properFileLock = { async withLock(file, fn) {
	const release = await lockfile.lock(file, {
		stale: 3e4,
		update: 1e4,
		retries: {
			retries: 10,
			factor: 1.5,
			minTimeout: 50,
			maxTimeout: 2e3
		}
	});
	try {
		return await fn();
	} finally {
		await release();
	}
} };
function isEncrypted(value) {
	return value.startsWith(ENC_PREFIX);
}
/** Decrypt one account's refresh/proxy fields when encrypted; plaintext passes through (legacy). */
function decryptAccount(account, codec) {
	let out = account;
	if (isEncrypted(out.refresh)) out = {
		...out,
		refresh: codec.decrypt(out.refresh)
	};
	if (out.proxy && isEncrypted(out.proxy)) out = {
		...out,
		proxy: codec.decrypt(out.proxy)
	};
	return out;
}
/** Encrypt one account's refresh/proxy fields (plaintext stays plaintext if no codec change). */
function encryptAccount(account, codec) {
	let out = account;
	if (!isEncrypted(out.refresh)) out = {
		...out,
		refresh: codec.encrypt(out.refresh)
	};
	if (out.proxy && !isEncrypted(out.proxy)) out = {
		...out,
		proxy: codec.encrypt(out.proxy)
	};
	return out;
}
/** Mask a proxy URL for display/logs: protocol//host:port (no credentials, no query). */
function maskProxyUrl(proxyUrl) {
	if (!proxyUrl) return null;
	try {
		const u = new URL(proxyUrl);
		const port = u.port || (u.protocol === "https:" ? "443" : u.protocol === "socks5:" || u.protocol === "socks5h:" ? "1080" : "8080");
		return `${u.protocol}//${u.hostname}:${port}`;
	} catch {
		return null;
	}
}
function ensureAccountIds(storage) {
	let mutated = false;
	const seenIds = /* @__PURE__ */ new Set();
	for (const account of storage.accounts) {
		if (!account.id || seenIds.has(account.id)) {
			account.id = randomUUID();
			mutated = true;
		}
		seenIds.add(account.id);
	}
	return {
		storage,
		mutated
	};
}
function decryptStorage(storage, codec) {
	return {
		...storage,
		accounts: storage.accounts.map((a) => decryptAccount(a, codec))
	};
}
function encryptStorage(storage, codec) {
	return {
		...storage,
		accounts: storage.accounts.map((a) => encryptAccount(a, codec))
	};
}
function migrateV1ToV2(v1) {
	return {
		version: 2,
		accounts: v1.accounts.map((acc) => ({
			email: acc.email,
			refreshToken: acc.refreshToken,
			projectId: acc.projectId,
			managedProjectId: acc.managedProjectId,
			addedAt: acc.addedAt,
			lastUsed: acc.lastUsed,
			lastSwitchReason: acc.lastSwitchReason,
			rateLimitResetTimes: acc.isRateLimited && acc.rateLimitResetTime ? { default: acc.rateLimitResetTime } : void 0
		})),
		activeIndex: v1.activeIndex
	};
}
function migrateV2ToV3(v2) {
	return {
		version: 3,
		accounts: v2.accounts.map((acc) => ({
			email: acc.email,
			refresh: `${acc.refreshToken}|${acc.projectId ?? ""}|${acc.managedProjectId ?? ""}`,
			projectId: acc.projectId,
			managedProjectId: acc.managedProjectId,
			addedAt: acc.addedAt,
			lastUsed: acc.lastUsed,
			enabled: true,
			lastSwitchReason: acc.lastSwitchReason,
			rateLimitResetTimes: acc.rateLimitResetTimes
		})),
		activeIndex: v2.activeIndex
	};
}
function migrateV3ToV4(v3) {
	return {
		version: 4,
		accounts: v3.accounts,
		activeIndex: v3.activeIndex
	};
}
function migrateStorage(raw) {
	switch (raw.version) {
		case 1: return migrateStorage(migrateV1ToV2(raw));
		case 2: return migrateStorage(migrateV2ToV3(raw));
		case 3: return migrateStorage(migrateV3ToV4(raw));
		case 4: return raw;
		default: throw new Error(`migrateStorage: unsupported storage version ${raw.version}`);
	}
}
var JsonAccountStore = class {
	file;
	codec;
	lock;
	constructor(options) {
		this.file = options.file;
		this.codec = options.codec;
		this.lock = options.lock ?? properFileLock;
	}
	ensureFile() {
		if (existsSync(this.file)) return;
		mkdirSync(dirname(this.file), { recursive: true });
		const tmp = `${this.file}.tmp-init`;
		writeFileSync(tmp, JSON.stringify({
			version: 4,
			accounts: [],
			activeIndex: 0
		}) + "\n", { mode: 384 });
		renameSync(tmp, this.file);
	}
	readAndMigrateUnlocked() {
		let text;
		try {
			text = readFileSync(this.file, "utf8");
		} catch (error) {
			if (error.code === "ENOENT") return {
				storage: {
					version: 4,
					accounts: [],
					activeIndex: 0
				},
				mutated: false
			};
			throw error;
		}
		assertOwnerOnly(this.file);
		return ensureAccountIds(decryptStorage(migrateStorage(JSON.parse(text)), this.codec));
	}
	writeUnlocked(storage) {
		const encrypted = encryptStorage(ensureAccountIds(storage).storage, this.codec);
		mkdirSync(dirname(this.file), { recursive: true });
		const tmp = `${this.file}.tmp`;
		writeFileSync(tmp, JSON.stringify(encrypted, null, 2) + "\n", { mode: 384 });
		renameSync(tmp, this.file);
	}
	/**
	* Materialize and persist generated/repaired UUIDs under the file lock:
	* re-reads the fresh on-disk state under the lock so concurrent mutations
	* are never clobbered by a stale pre-lock snapshot.
	*/
	async materializeIdsWithLock() {
		this.ensureFile();
		return this.lock.withLock(this.file, async () => {
			const { storage, mutated } = this.readAndMigrateUnlocked();
			if (mutated) this.writeUnlocked(storage);
			return storage;
		});
	}
	async load() {
		const { storage, mutated } = this.readAndMigrateUnlocked();
		if (mutated) return this.materializeIdsWithLock();
		return storage;
	}
	async save(storage) {
		this.ensureFile();
		await this.lock.withLock(this.file, async () => {
			this.writeUnlocked(storage);
		});
	}
	async mutate(fn) {
		this.ensureFile();
		return this.lock.withLock(this.file, async () => {
			const { storage } = this.readAndMigrateUnlocked();
			const result = await fn(storage);
			this.writeUnlocked(storage);
			return result;
		});
	}
};
//#endregion
export { isSessionAccumulationOverflow as C, describeFetchError as S, persistMasterKey as _, generateFingerprint as a, classifyFetchError as b, resolveAntigravityVersionBounded as c, agyDataFile as d, migrateToAgyDir as f, loadMasterKey as g, deriveKey as h, isAgyDisabled as i, clearExpiredState as l, createAesGcmCodec as m, maskProxyUrl as n, recordFingerprintVersion as o, MASTER_KEY_REF as p, AgySessionManager as r, resolveAntigravityVersion as s, JsonAccountStore as t, pickProbeProxyUrl as u, resolveDshHome as v, classifyHttpError as x, resolveMasterKeyCodec as y };

//# sourceMappingURL=accounts-B2cbfi3y.mjs.map