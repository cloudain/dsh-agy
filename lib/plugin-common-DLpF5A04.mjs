import { b as AgyPoolBlockedError, h as fetchAgyFirstOk, y as AgyAuthError } from "./constants-BboCQZJG.mjs";
import { a as probeFetch, o as proxiedFetch, t as accountFetch } from "./proxy-B7VnbAfO.mjs";
import { C as isSessionAccumulationOverflow, S as describeFetchError, _ as persistMasterKey, b as classifyFetchError, f as migrateToAgyDir, g as loadMasterKey, h as deriveKey, m as createAesGcmCodec, p as MASTER_KEY_REF, r as AgySessionManager, s as resolveAntigravityVersion, t as JsonAccountStore, u as pickProbeProxyUrl, v as resolveDshHome, x as classifyHttpError, y as resolveMasterKeyCodec } from "./accounts-B2cbfi3y.mjs";
import { i as generateAntigravityRequestId, n as currentSessionGeneration, r as deriveAntigravitySessionId, t as bumpSessionGeneration } from "./identity-Ci8EGc1F.mjs";
import { i as setThoughtSignature, r as resolveMultimodalFiles, t as toAgyRequestBody } from "./translate-z9iY0k3O.mjs";
import { n as UnmappedFinishReasonError, r as parseAgySse, t as AgyStreamIdleTimeoutError } from "./parse-BFsVTalF.mjs";
import { i as resolveAgyModel, n as listAgyModels, t as catalogModelList } from "./models-ev8NAQa3.mjs";
import { randomBytes } from "node:crypto";
import { LlmAdapter, LlmError, ProviderRequestId, QUOTA_EXCEEDED_CODE } from "@deepseek-ai/dsh-llm";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import lockfile from "proper-lockfile";
//#region src/adapter/adapter.ts
/**
* AgyAdapter: the DSH seam. A thin orchestrator over the deep modules —
* account session resolution (shell-provided), request translation, SSE
* parsing, failure classification, and rotation reporting. All wire details
* live in translate.ts / parse.ts / models.ts.
*/
/** Collect image refs from user-message content only (spec scope: user images; tool-result nesting out of scope). */
function collectImageRefs(options) {
	const refs = [];
	for (const message of options.messages) {
		if (message.role !== "user") continue;
		for (const block of message.content) if (block.type === "image") refs.push(block.attachment);
	}
	return refs;
}
const UPSTREAM_ERROR_CODE = "UPSTREAM";
/** First-class DSH retryable code: the default retry policy honors SERVER (5xx), not UPSTREAM. */
const SERVER_ERROR_CODE = "SERVER";
/** Abort-aware delay helper for transient stream retries. */
async function sleepWithSignal(ms, signal) {
	if (signal?.aborted) throw new DOMException("aborted", "AbortError");
	await new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer);
			reject(new DOMException("aborted", "AbortError"));
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		if (!signal) return;
		signal.addEventListener("abort", onAbort, { once: true });
	});
}
/** Stable ledger key for an account: email when present, else the generated id. */
function ledgerAccountKey(session) {
	return session.account.email ?? session.account.id;
}
/**
* Build the impersonation headers for one request.
*
* There is NO request-id header. `x-goog-request-id` used to be sent here and is
* present in neither official binary; the id the backend correlates on is the
* body's `requestId` field, which this request already carries. An invented
* header is a shape no official client emits, which is precisely the anomaly the
* impersonation set exists to avoid.
*
* `User-Agent` carries the Antigravity client string and NOTHING else. The
* harness's `attributionHeaders()` is deliberately not merged in: it returns a
* lowercase `user-agent` key, so spreading it alongside the camel-case
* `session.impersonation` produced TWO distinct object properties that `fetch`
* folded into one comma-joined value —
*
*   `deepseek-harness/<v> (+url), antigravity/<v> <platform>`
*
* — a header no official client can emit, byte-identical for every dsh-agy
* user, and therefore a stronger fingerprint than the one it was trying to
* avoid. There is exactly one `User-Agent` field on the wire and the upstream
* requires it to be the client identity, so this request cannot carry both.
*
* This adapter performs its own dispatch (see the `fetchAgyFirstOk` call in
* `stream()`); nothing downstream re-adds the header.
*/
function buildRequestHeaders(session) {
	return {
		authorization: `Bearer ${session.auth.access}`,
		"content-type": "application/json",
		accept: "text/event-stream",
		"User-Agent": session.impersonation["User-Agent"],
		"X-Goog-Api-Client": session.impersonation["X-Goog-Api-Client"]
	};
}
var AgyAdapter = class extends LlmAdapter {
	options;
	cachedModels = null;
	inFlightModels = null;
	constructor(options) {
		super();
		this.options = options;
	}
	providerInfo(_provider) {
		return {
			id: "agy",
			name: "Antigravity (agy)"
		};
	}
	/**
	* The catalog as DSH's model selector sees it: discovered models minus the
	* user's hidden set. Filtering here is what makes "turn a model off" hide it
	* from the picker — the selector reads this, and DSH itself is untouched.
	*/
	async listModels(_provider) {
		const all = await this.listAllModels();
		const hidden = this.options.modelVisibility?.disabledFor("agy");
		if (hidden === void 0 || hidden.size === 0) return all;
		return all.filter((model) => !hidden.has(model.id));
	}
	/**
	* The complete catalog, ignoring the user's hidden set.
	*
	* Cached in memory for `MODEL_LIST_CACHE_TTL_MS` with in-flight deduplication.
	* DSH 0.2.0-rc.1 calls `listModels` on every model and effort selection via
	* `requireModel`; without caching, each click paid a multi-second round-trip to
	* Google's `fetchAvailableModels` through the proxy, showing a loading spinner
	* on every interaction.
	*
	* The settings page lists models through this rather than `listModels`: if it
	* read the filtered list, a hidden model would vanish from the page along
	* with the switch that hides it, leaving no way to turn it back on without
	* hand-editing the file.
	*/
	async listAllModels(force = false) {
		const now = Date.now();
		if (!force && this.cachedModels && now - this.cachedModels.at < 6e5) return this.cachedModels.models;
		if (this.inFlightModels) return this.inFlightModels;
		const task = (async () => {
			try {
				const session = await this.options.getSession();
				const routing = { proxyUrl: session?.account.proxy };
				const models = await listAgyModels(session?.auth.access, session?.account.projectId, accountFetch(routing));
				this.cachedModels = {
					models,
					at: Date.now()
				};
				return models;
			} catch (error) {
				if (error instanceof AgyPoolBlockedError || error instanceof AgyAuthError) return catalogModelList();
				if (this.cachedModels) return this.cachedModels.models;
				throw error;
			} finally {
				this.inFlightModels = null;
			}
		})();
		this.inFlightModels = task;
		return task;
	}
	/**
	* Drop the cached model list.
	*
	* Model discovery is account-scoped (what `fetchAvailableModels` reports and
	* which proxy it rides depend on the account), but the cache is deliberately
	* keyed to NO account: a keyed read would have to call `getSession()` on
	* every hit, and that call can probe quota or refresh a token — the network
	* cost this cache exists to remove. Every event that can switch the account
	* discovery rides (activation, rotation) therefore drops the cache instead.
	*/
	invalidateModelCache() {
		this.cachedModels = null;
	}
	async resolveModel(provider, model) {
		return resolveAgyModel(provider, model);
	}
	/**
	* Pre-resolve every image attachment into base64 bytes before translation.
	* Image input hard-fails with UNSUPPORTED_CONTENT (terminal, never retried)
	* when the store is missing or a read fails — silently dropping images and
	* sending text-only is the exact failure mode this path exists to prevent.
	*/
	async resolveRequestImages(options) {
		const refs = collectImageRefs(options);
		const images = /* @__PURE__ */ new Map();
		if (refs.length === 0) return images;
		const store = this.options.resolveAttachments?.();
		if (!store) throw new LlmError("agy image input requires the durable attachment service (in-harness plugin only)", "UNSUPPORTED_CONTENT");
		const settled = await Promise.allSettled(refs.map(async (ref) => {
			const stored = await store.readImage(ref);
			return {
				attachmentId: ref.attachmentId,
				image: {
					mediaType: stored.ref.mediaType,
					data: Buffer.from(stored.data).toString("base64")
				}
			};
		}));
		const failedIndex = settled.findIndex((outcome) => outcome.status === "rejected");
		if (failedIndex !== -1) {
			const ref = refs[failedIndex];
			const cause = settled[failedIndex].reason;
			throw new LlmError(`agy image attachment "${ref.attachmentId}" could not be loaded: ${cause instanceof Error ? cause.message : String(cause)}`, "UNSUPPORTED_CONTENT", { cause: cause instanceof Error ? cause : void 0 });
		}
		for (const outcome of settled) if (outcome.status === "fulfilled") images.set(outcome.value.attachmentId, outcome.value.image);
		return images;
	}
	async *stream(options) {
		const holder = {};
		try {
			yield* this.streamInner(options, holder);
		} finally {
			if (holder.account !== void 0) this.options.noteRequestSettled?.(holder.account);
		}
	}
	async *streamInner(options, holder) {
		const images = await this.resolveRequestImages(options);
		/**
		* The DSH agent loop stamps `options.sessionId` on every request it builds,
		* so it is the conversation identity — used both to scope account affinity
		* here and to derive the upstream `sessionId` below.
		*/
		const conversationKey = options.sessionId === void 0 ? void 0 : String(options.sessionId);
		let session;
		try {
			session = await this.options.getSession(options.model, conversationKey);
		} catch (error) {
			if (error instanceof AgyAuthError) {
				if (error.kind === "transport") throw new LlmError(error.message, "TRANSPORT", { cause: error });
				if (error.kind === "rate-limit") throw new LlmError(error.message, "RATE_LIMIT", { requestId: ProviderRequestId(generateAntigravityRequestId()) });
				throw new LlmError(error.message, "INVALID_CREDENTIAL", { cause: error });
			}
			if (error instanceof AgyPoolBlockedError) {
				if (error.kind === "quota-exhausted") throw new LlmError(error.message, QUOTA_EXCEEDED_CODE);
				const delta = Math.ceil(error.blockedUntil - Date.now());
				const providerRetryAfterMs = Number.isFinite(delta) && delta > 0 ? delta : 1;
				throw new LlmError(error.message, "RATE_LIMIT", {
					providerRetryAfterMs,
					requestId: ProviderRequestId(generateAntigravityRequestId())
				});
			}
			throw error;
		}
		if (!session) throw new LlmError("No agy account configured — run `dsh-agy login` to authenticate.", "NO_CREDENTIAL");
		const multimodalFiles = await resolveMultimodalFiles(options, { maxBytes: this.options.maxInlineBytes?.() });
		holder.account = session.account;
		this.options.noteRequestStarted?.(session.account);
		const conversationAccount = ledgerAccountKey(session);
		const routing = {
			proxyUrl: session.account.proxy,
			streaming: true
		};
		/**
		* Send one request, resending at most once when the upstream reports the
		* per-`sessionId` accumulation wall.
		*
		* The upstream accumulates a conversation's input server-side per
		* `sessionId`; once that passes 1M tokens every request reusing the id fails
		* with a 400 until the upstream session expires. Bumping the generation
		* names a fresh upstream session and recovers the conversation. This is not
		* an account fault, so it does not go through `reportFailure`: the account
		* stays healthy and only the derived id changes.
		*
		* `attemptStartedAt` is the clock of the outer attempt that owns this send,
		* so a transport failure is billed to that attempt rather than to the call.
		*/
		const sendAttempt = async (attemptStartedAt) => {
			for (let attempt = 0;; attempt++) {
				const generation = conversationKey !== void 0 && conversationAccount !== void 0 ? currentSessionGeneration(conversationAccount, conversationKey) : 0;
				const requestId = generateAntigravityRequestId();
				const body = toAgyRequestBody(options, {
					projectId: session.account.projectId,
					sessionId: deriveAntigravitySessionId(session.account.email, conversationKey, generation) ?? void 0,
					requestId,
					...this.options.thinkingBudgetFor === void 0 ? {} : { thinkingBudgetFor: this.options.thinkingBudgetFor },
					...this.options.claudeBudgetFor === void 0 ? {} : { claudeBudgetFor: this.options.claudeBudgetFor },
					...this.options.tieredBudgetFor === void 0 ? {} : { tieredBudgetFor: this.options.tieredBudgetFor },
					...images.size > 0 ? { images } : {},
					...multimodalFiles.size > 0 ? { multimodalFiles } : {}
				});
				let response;
				try {
					response = await fetchAgyFirstOk("/v1internal:streamGenerateContent?alt=sse", {
						method: "POST",
						headers: buildRequestHeaders(session),
						body: JSON.stringify(body),
						signal: options.signal
					}, accountFetch(routing), routing);
				} catch (error) {
					const classified = classifyFetchError(error, { proxyUrl: session.account.proxy });
					await this.options.reportFailure(classified.kind, session);
					this.recordUsage(session, options.model, {
						ok: false,
						reason: "network-error"
					}, attemptStartedAt);
					throw new LlmError(classified.message ?? "agy fetch failed", "TRANSPORT", { cause: error });
				}
				if (response.ok) return { response };
				const bodyText = await response.text().catch(() => void 0);
				if (attempt === 0 && conversationKey !== void 0 && conversationAccount !== void 0 && isSessionAccumulationOverflow(response.status, bodyText)) {
					bumpSessionGeneration(conversationAccount, conversationKey);
					continue;
				}
				return {
					response,
					bodyText
				};
			}
		};
		/**
		* Maximum internal retries when the upstream ends a stream with
		* `MALFORMED_FUNCTION_CALL` before any user-facing text chunks have been
		* yielded to DSH. Gemini models occasionally glitch on tool-call JSON syntax;
		* re-sampling cleanly recovers the turn without crashing the conversation.
		*
		* This deliberately generalises the `sendAttempt` accumulation-wall resend
		* into the stream path: the invariant that one DSH call is one provider
		* attempt now has this second, documented exception (see AGENTS.md, "the
		* adapter does not silent-retry"). Both exceptions share the same shape —
		* the account is healthy and the request was accepted — and neither goes
		* through `reportFailure`, so the pool sees nothing.
		*/
		const MAX_MALFORMED_RETRIES = 3;
		for (let malformedAttempt = 0;; malformedAttempt++) {
			const attemptStartedAt = Date.now();
			const { response, bodyText } = await sendAttempt(attemptStartedAt);
			if (!response.ok) {
				const classified = classifyHttpError(response.status, response.headers, bodyText);
				await this.options.reportFailure(classified.kind, session, {
					retryAfterMs: classified.retryAfterMs,
					status: response.status,
					rateLimitCategory: classified.rateLimitCategory,
					resetTime: classified.resetTime,
					model: options.model,
					verificationUrl: classified.verificationUrl
				});
				this.recordUsage(session, options.model, {
					ok: false,
					rateLimited: classified.kind === "rate-limit",
					reason: classified.kind
				}, attemptStartedAt);
				if (classified.kind === "rate-limit") {
					if (classified.rateLimitCategory === "quota_exhausted") throw new LlmError(`agy daily quota exhausted (${response.status}): ${classified.message ?? ""}`, QUOTA_EXCEEDED_CODE);
					throw new LlmError(`agy rate-limited (${response.status}): ${classified.message ?? ""}`, "RATE_LIMIT", {
						providerRetryAfterMs: classified.retryAfterMs ?? void 0,
						requestId: ProviderRequestId(generateAntigravityRequestId())
					});
				}
				if (classified.kind === "verification-required") {
					const appeal = classified.verificationUrl ? ` Verify at: ${classified.verificationUrl}` : "";
					throw new LlmError(`agy account needs verification (${response.status}): ${classified.message ?? ""}${appeal}`, "RATE_LIMIT", { requestId: ProviderRequestId(generateAntigravityRequestId()) });
				}
				if (classified.kind === "auth-failure") throw new LlmError(`agy authentication failed (${response.status}) — run \`dsh-agy login\``, "INVALID_CREDENTIAL");
				if (classified.status !== void 0 && classified.status >= 500) throw new LlmError(`agy upstream error (${response.status}): ${classified.message ?? ""}`, SERVER_ERROR_CODE, {
					providerRetryAfterMs: classified.retryAfterMs ?? void 0,
					requestId: ProviderRequestId(generateAntigravityRequestId())
				});
				throw new LlmError(`agy upstream error (${response.status}): ${classified.message ?? ""}`, UPSTREAM_ERROR_CODE);
			}
			if (!response.body) throw new LlmError("agy stream returned no body", UPSTREAM_ERROR_CODE);
			const bufferedChunks = [];
			/**
			* Thought signatures observed during this attempt, held back with the
			* chunks that carried them. `onToolSignature` fires as soon as the parser
			* sees a signature, i.e. BEFORE the attempt is known to be keepable, so
			* caching eagerly would let a discarded attempt write the process-global
			* signature cache (keyed by `toolCallId` — and issue #99 records those ids
			* colliding across distant turns, which would poison the very retry it
			* triggered).
			*/
			const pendingSignatures = [];
			let yieldedDirect = false;
			let usage;
			let ttftMs;
			/**
			* Persist the signatures observed so far.
			*
			* Called at every point where the chunks that carried them have been
			* handed off — never on the discard path, so a thrown-away attempt leaves
			* no trace. The hand-off is the only sound anchor: a `functionCall` can
			* arrive AFTER the first `text-delta` (text-then-tool is a common shape),
			* so anchoring at stream end would drop the signature of an already
			* delivered call the moment the stream dies mid-body, silently degrading
			* the next round to the sentinel.
			*/
			const commitSignatures = () => {
				for (const [toolCallId, signature] of pendingSignatures) setThoughtSignature(toolCallId, signature);
				pendingSignatures.length = 0;
			};
			/** Hand the held chunks to the consumer. */
			const drainBuffer = () => {
				const drained = bufferedChunks.slice();
				bufferedChunks.length = 0;
				return drained;
			};
			try {
				let actualModelVersion;
				for await (const chunk of parseAgySse(response.body, {
					signal: options.signal,
					disambiguateToolCallIds: true,
					onToolSignature: (toolCallId, signature) => {
						pendingSignatures.push([toolCallId, signature]);
					},
					onModelVersion: (version) => {
						actualModelVersion = version;
					}
				})) {
					if (chunk.type === "usage") usage = {
						input: chunk.usage.inputTokens,
						output: chunk.usage.outputTokens,
						cacheRead: chunk.usage.cacheReadTokens ?? 0,
						cacheWrite: chunk.usage.cacheWriteTokens ?? 0
					};
					if (yieldedDirect) {
						if (pendingSignatures.length !== 0) commitSignatures();
						yield chunk;
					} else if (chunk.type === "text-delta") {
						yieldedDirect = true;
						commitSignatures();
						ttftMs = Date.now() - attemptStartedAt;
						for (const buffered of drainBuffer()) yield buffered;
						yield chunk;
					} else bufferedChunks.push(chunk);
				}
				if (ttftMs === void 0) ttftMs = Date.now() - attemptStartedAt;
				commitSignatures();
				for (const buffered of drainBuffer()) yield buffered;
				await this.options.markSuccess?.(session);
				this.recordUsage(session, options.model, {
					ok: true,
					usage,
					ttftMs,
					actualModel: actualModelVersion
				}, attemptStartedAt);
				return;
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					this.recordUsage(session, options.model, {
						ok: false,
						reason: "aborted",
						usage
					}, attemptStartedAt);
					await response.body?.cancel().catch(() => {});
					throw new LlmError("agy stream aborted", "ABORTED", { cause: error });
				}
				if (error instanceof AgyStreamIdleTimeoutError && !yieldedDirect) {
					await this.options.reportFailure("network-error", session);
					this.recordUsage(session, options.model, {
						ok: false,
						reason: "network-error",
						usage
					}, attemptStartedAt);
					await response.body?.cancel().catch(() => {});
					throw new LlmError(`${error.message} — nothing was delivered, retrying`, "TIMEOUT", { cause: error });
				}
				if (error instanceof UnmappedFinishReasonError && error.reason === "MALFORMED_FUNCTION_CALL" && !yieldedDirect && malformedAttempt < MAX_MALFORMED_RETRIES) {
					this.recordUsage(session, options.model, {
						ok: false,
						reason: "request-error",
						usage
					}, attemptStartedAt);
					await response.body?.cancel().catch(() => {});
					try {
						await sleepWithSignal(200 * (malformedAttempt + 1), options.signal);
					} catch (sleepError) {
						if (sleepError instanceof DOMException && sleepError.name === "AbortError") throw new LlmError("agy stream aborted", "ABORTED", { cause: sleepError });
						throw sleepError;
					}
					continue;
				}
				const unmappedFinish = error instanceof UnmappedFinishReasonError;
				await this.options.reportFailure(unmappedFinish ? "request-error" : "network-error", session);
				this.recordUsage(session, options.model, {
					ok: false,
					reason: unmappedFinish ? "request-error" : "network-error",
					usage
				}, attemptStartedAt);
				await response.body?.cancel().catch(() => {});
				throw new LlmError(error instanceof Error ? describeFetchError(error) : "agy stream parse failed", UPSTREAM_ERROR_CODE, { cause: error });
			}
		}
	}
	/**
	* Fold one attempt into the usage ledger.
	*
	* Statistics are diagnostics, never load-bearing: a ledger failure must not
	* fail a generation, so this swallows its own errors.
	*/
	recordUsage(session, model, result, startedAt) {
		const record = this.options.recordUsage;
		if (record === void 0) return;
		try {
			record({
				...ledgerAccountKey(session) === void 0 ? {} : { account: ledgerAccountKey(session) },
				...model === void 0 ? {} : { model },
				...result.actualModel === void 0 ? {} : { actualModel: result.actualModel },
				ok: result.ok,
				...result.rateLimited === true ? { rateLimited: true } : {},
				...result.reason === void 0 ? {} : { reason: result.reason },
				...result.usage === void 0 ? {} : { usage: result.usage },
				...result.ttftMs === void 0 ? {} : { ttftMs: result.ttftMs },
				latencyMs: Math.max(0, Date.now() - startedAt)
			});
		} catch {}
	}
};
const EMPTY_SET = /* @__PURE__ */ new Set();
/** Keep only well-formed `provider -> { modelId: true }` entries (tolerates hand edits). */
function sanitizeDisabledModels(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
	const out = {};
	for (const [provider, value] of Object.entries(raw)) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
		const perProvider = {};
		for (const [modelId, flag] of Object.entries(value)) if (flag === true) perProvider[modelId] = true;
		if (Object.keys(perProvider).length > 0) out[provider] = perProvider;
	}
	return out;
}
function parseModelVisibility(text) {
	let raw;
	try {
		raw = JSON.parse(text);
	} catch {
		return {
			version: 1,
			disabled: {}
		};
	}
	return {
		version: 1,
		disabled: typeof raw === "object" && raw !== null ? sanitizeDisabledModels(raw.disabled) : {}
	};
}
/**
* In-memory authoritative copy of the blacklist, backed by a JSON file.
*
* The adapter calls `disabledFor()` on every `listModels()`, so that read is a
* pure in-memory lookup: a toggle takes effect on the next catalog refresh
* without rebuilding the adapter or restarting the host. Writes go through the
* file immediately (toggles are rare, user-initiated).
*
* `disabledFor()` also revalidates against the file's mtime and reloads when it
* moved. Two instances of this class routinely coexist in ONE process — the
* main plugin entry and the web entry each build their own runtime — and a
* toggle is written by the web instance while the model selector reads the main
* instance. Without the mtime check the selector would keep serving its stale
* in-memory copy, so switching a model off appeared to do nothing until the
* host restarted (the `llm/adapters-updated` notification fires, the picker
* refreshes, and the model is still listed). The same check is what lets a CLI
* toggle be seen by a running server.
*/
var ModelVisibility = class ModelVisibility {
	file;
	disabled;
	/** Raw text this instance last read or wrote; see `reloadIfChanged`. */
	raw;
	/** Reusable frozen empty set, so the common "nothing disabled" read allocates nothing. */
	sets = /* @__PURE__ */ new Map();
	constructor(options = {}) {
		this.file = options.file ?? migrateToAgyDir("agy-models.json").file;
		const initial = this.readWithRaw();
		this.disabled = initial.disabled;
		this.raw = initial.raw;
	}
	/** Path of the backing file. */
	get path() {
		return this.file;
	}
	/** The exact bytes `write()` would persist, so `raw` can track what this instance wrote. */
	static serialize(next) {
		return JSON.stringify({
			version: 1,
			disabled: next
		}, null, 2) + "\n";
	}
	/**
	* Read the map together with the raw text it came from.
	*
	* The TEXT (not an mtime) is what detects another writer's change. An mtime
	* cannot: a toggle and a re-read can land in the same filesystem timestamp
	* tick, and Windows resolves that coarsely enough to have failed CI — two
	* distinct writes reported an identical mtime, so the second change was never
	* seen and a disabled model stayed selectable. Content comparison cannot miss
	* a change, whatever the clock resolution.
	*/
	readWithRaw() {
		try {
			const raw = readFileSync(this.file, "utf8");
			return {
				disabled: parseModelVisibility(raw).disabled,
				raw
			};
		} catch {
			return {
				disabled: {},
				raw: ""
			};
		}
	}
	write(next) {
		mkdirSync(dirname(this.file), { recursive: true });
		const tmp = `${this.file}.tmp`;
		writeFileSync(tmp, ModelVisibility.serialize(next), { mode: 384 });
		renameSync(tmp, this.file);
	}
	/**
	* Disabled model ids for one provider. Cheap enough for every catalog refresh:
	* one `stat` plus an in-memory map lookup, and the stat is what keeps two
	* same-process instances (and a CLI writer) in agreement.
	*/
	disabledFor(provider) {
		this.reloadIfChanged();
		const cacheKey = provider;
		const cached = this.sets.get(cacheKey);
		if (cached !== void 0) return cached;
		const perProvider = this.disabled[provider];
		if (perProvider === void 0) return EMPTY_SET;
		const ids = Object.keys(perProvider);
		if (ids.length === 0) return EMPTY_SET;
		const set = new Set(ids);
		this.sets.set(cacheKey, set);
		return set;
	}
	/** Whether one model is currently hidden. Also revalidates, for the same reason. */
	isDisabled(provider, modelId) {
		this.reloadIfChanged();
		return this.disabled[provider]?.[modelId] === true;
	}
	/** The raw map, for the settings UI. */
	all() {
		const out = {};
		for (const [provider, models] of Object.entries(this.disabled)) out[provider] = { ...models };
		return out;
	}
	/**
	* Hide or show one model. Persists immediately.
	*
	* The edit is applied to a freshly re-read map, not to this instance's copy:
	* with two instances in one process (main plugin + web entry) and a CLI in
	* another, editing the stale copy would silently drop whatever the other
	* writer had toggled since this instance last read. Toggles are rare and
	* user-initiated, so a read-modify-write costs nothing here — unlike the
	* ledger, this is not a hot path.
	*
	* Not locked: a simultaneous toggle from two processes can still lose one of
	* the two updates. The write itself is atomic (tmp + rename), so the file is
	* never corrupt — losing one toggle under a genuine race is an acceptable
	* trade for not introducing a lock file into a settings toggle.
	*/
	setDisabled(provider, modelId, disabled) {
		if (modelId === "") throw new Error("setDisabled: modelId must not be empty");
		this.reload();
		const next = {};
		for (const [key, models] of Object.entries(this.disabled)) next[key] = { ...models };
		const perProvider = { ...next[provider] ?? {} };
		if (disabled) perProvider[modelId] = true;
		else delete perProvider[modelId];
		if (Object.keys(perProvider).length === 0) delete next[provider];
		else next[provider] = perProvider;
		this.write(next);
		this.disabled = next;
		this.raw = ModelVisibility.serialize(next);
		this.sets.delete(provider);
	}
	/** Re-read the file (multi-process: another writer may have toggled a model). */
	reload() {
		const fresh = this.readWithRaw();
		this.disabled = fresh.disabled;
		this.raw = fresh.raw;
		this.sets.clear();
	}
	/**
	* Reload when the file's contents differ from what this instance last read.
	*
	* Reads rather than stats: `disabledFor()` runs once per catalog refresh, not
	* per request, and the call it feeds is a network request to the model
	* endpoint — one small local read is not the cost that matters here, while a
	* missed change is the bug this whole mechanism exists to prevent.
	*/
	reloadIfChanged() {
		let current;
		try {
			current = readFileSync(this.file, "utf8");
		} catch {
			current = "";
		}
		if (current === this.raw) return;
		this.reload();
	}
};
/** Whether `value` may be stored as a per-file inline cap: an integer MB in range. */
function isValidMultimodalMb(value) {
	return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100;
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
const THINKING_BUDGET_MAX = 65535;
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
/** Whether `value` may be sent as a Claude `thinkingBudget`. */
function isValidClaudeBudget(value) {
	if (typeof value !== "number" || !Number.isInteger(value)) return false;
	if (value === -1 || value === 0) return true;
	return value >= 1024 && value <= 63999;
}
/** Whether `value` may be sent as a `thinkingBudget`. */
function isValidThinkingBudget(value) {
	return typeof value === "number" && Number.isInteger(value) && value >= -1 && value <= 65535;
}
/**
* Keep only well-formed entries (tolerates hand edits).
*
* Rejects out-of-range and non-integer values rather than clamping them: a
* clamped value would silently mean something the user did not ask for, and
* upstream rejects it anyway, so dropping the entry falls back to the
* `thinkingLevel` path — which is valid.
*/
function sanitizeThinkingBudgets(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
	const out = {};
	for (const level of THINKING_LEVELS) {
		const value = raw[level];
		if (isValidThinkingBudget(value)) out[level] = value;
	}
	return out;
}
function parseThinkingDocument(text) {
	let raw;
	try {
		raw = JSON.parse(text);
	} catch {
		return {
			version: 1,
			budgets: {}
		};
	}
	const record = typeof raw === "object" && raw !== null ? raw : {};
	const budgets = sanitizeThinkingBudgets(record.budgets);
	const claude = record.claudeBudget;
	const tiered = record.tieredBudget;
	return {
		version: 1,
		budgets,
		...isValidClaudeBudget(claude) ? { claudeBudget: claude } : {},
		...isValidThinkingBudget(tiered) ? { tieredBudget: tiered } : {}
	};
}
/**
* In-memory authoritative copy of the budgets, backed by a JSON file.
*
* `budgetFor` sits on the GENERATION HOT PATH (`toAgyRequestBody` calls it for
* every request), so the cross-instance revalidation it needs is rate-limited:
* see `revalidateIntervalMs`. Writes go to the file immediately, since edits are
* rare and user-initiated, and they bypass the limit so a concurrent edit is
* never overwritten.
*/
var ThinkingBudgetStore = class ThinkingBudgetStore {
	file;
	revalidateIntervalMs;
	doc;
	/** Raw text this instance last read or wrote; see `reloadNow`. */
	raw;
	/** When `reloadNow` last ran, for the hot-path throttle. */
	checkedAt;
	constructor(options = {}) {
		this.file = options.file ?? migrateToAgyDir("agy-thinking.json").file;
		this.revalidateIntervalMs = options.revalidateIntervalMs ?? 1e3;
		const initial = this.readWithRaw();
		this.doc = initial.doc;
		this.raw = initial.raw;
		this.checkedAt = Date.now();
	}
	/** Path of the backing file. */
	get path() {
		return this.file;
	}
	static serialize(doc) {
		return JSON.stringify(doc, null, 2) + "\n";
	}
	/**
	* Read the document together with the raw text it came from.
	*
	* Content, not mtime: two writers can land in the same filesystem timestamp
	* tick (Windows resolves it coarsely enough to have failed CI in this repo),
	* and a missed change is exactly the bug this check exists to prevent.
	*/
	readWithRaw() {
		try {
			const raw = readFileSync(this.file, "utf8");
			return {
				doc: parseThinkingDocument(raw),
				raw
			};
		} catch {
			return {
				doc: {
					version: 1,
					budgets: {}
				},
				raw: ""
			};
		}
	}
	/**
	* Re-read the file if another writer changed it.
	*
	* Compares CONTENT, not mtime: a toggle and a re-read can land in the same
	* filesystem timestamp tick, and Windows resolves that coarsely enough to have
	* failed CI in this repo (`model-visibility.ts` records the incident). Content
	* comparison cannot miss a change, whatever the clock resolution.
	*
	* Unconditional — callers on the hot path use `reloadIfChanged` instead.
	*/
	reloadNow() {
		let current;
		try {
			current = readFileSync(this.file, "utf8");
		} catch {
			current = "";
		}
		this.checkedAt = Date.now();
		if (current === this.raw) return;
		const fresh = this.readWithRaw();
		this.doc = fresh.doc;
		this.raw = fresh.raw;
	}
	/**
	* Hot-path revalidation: `reloadNow`, rate-limited.
	*
	* Without the limit every generation pays a blocking `readFileSync` plus a
	* UTF-8 decode — the module used to claim these reads were "in-memory", which
	* an unconditional read made false. The file is written only by `setBudget`
	* (a rare, user-initiated action), so the worst case here is that a settings
	* change takes up to `revalidateIntervalMs` to reach an already-running
	* adapter. That is the right trade for a setting; it is not right for the write
	* path, which is why `write` calls `reloadNow` directly.
	*/
	reloadIfChanged() {
		if (Date.now() - this.checkedAt < this.revalidateIntervalMs) return;
		this.reloadNow();
	}
	/**
	* Write the whole document atomically.
	*
	* Always re-reads first, so a concurrent edit by the OTHER instance in this
	* process (main plugin + web entry) is merged rather than overwritten: each
	* caller passes a mutation, not a full replacement built from a stale copy.
	*/
	write(mutate) {
		this.reloadNow();
		const next = {
			version: 1,
			budgets: { ...this.doc.budgets },
			...this.doc.claudeBudget === void 0 ? {} : { claudeBudget: this.doc.claudeBudget },
			...this.doc.tieredBudget === void 0 ? {} : { tieredBudget: this.doc.tieredBudget }
		};
		mutate(next);
		const text = ThinkingBudgetStore.serialize(next);
		mkdirSync(dirname(this.file), { recursive: true });
		const tmp = `${this.file}.tmp`;
		writeFileSync(tmp, text, { mode: 384 });
		renameSync(tmp, this.file);
		this.doc = next;
		this.raw = text;
	}
	/** The configured budget for one level, or undefined when unset. */
	budgetFor(level) {
		this.reloadIfChanged();
		if (level === void 0) return void 0;
		const key = level.toLowerCase();
		if (!THINKING_LEVELS.includes(key)) return void 0;
		return this.doc.budgets[key];
	}
	/** The Claude-family budget, or undefined when unset. */
	claudeBudget() {
		this.reloadIfChanged();
		return this.doc.claudeBudget;
	}
	/** The tiered-slot budget (the selector's Default effort), or undefined. */
	tieredBudget() {
		this.reloadIfChanged();
		return this.doc.tieredBudget;
	}
	/** The raw map, for the settings UI. */
	all() {
		this.reloadIfChanged();
		return { ...this.doc.budgets };
	}
	/** The whole document, for the settings UI. */
	snapshot() {
		this.reloadIfChanged();
		return {
			version: 1,
			budgets: { ...this.doc.budgets },
			...this.doc.claudeBudget === void 0 ? {} : { claudeBudget: this.doc.claudeBudget },
			...this.doc.tieredBudget === void 0 ? {} : { tieredBudget: this.doc.tieredBudget }
		};
	}
	/** Replace one level's budget, or clear it when `value` is undefined. */
	setBudget(level, value) {
		const key = level.toLowerCase();
		if (!THINKING_LEVELS.includes(key)) throw new Error(`unknown thinking level: ${level}`);
		if (value !== void 0 && !isValidThinkingBudget(value)) throw new Error(`thinking budget must be an integer in [-1, ${THINKING_BUDGET_MAX}]`);
		this.write((doc) => {
			if (value === void 0) delete doc.budgets[key];
			else doc.budgets[key] = value;
		});
		return this.all();
	}
	/** Replace the tiered-slot budget, or clear it when `value` is undefined. */
	setTieredBudget(value) {
		if (value !== void 0 && !isValidThinkingBudget(value)) throw new Error(`thinking budget must be an integer in [-1, ${THINKING_BUDGET_MAX}]`);
		this.write((doc) => {
			if (value === void 0) delete doc.tieredBudget;
			else doc.tieredBudget = value;
		});
		return this.snapshot();
	}
	/** Replace the Claude budget, or clear it when `value` is undefined. */
	setClaudeBudget(value) {
		if (value !== void 0 && !isValidClaudeBudget(value)) throw new Error(`Claude thinking budget must be -1, 0, or an integer in [${CLAUDE_BUDGET_MIN}, ${CLAUDE_BUDGET_MAX}]`);
		this.write((doc) => {
			if (value === void 0) delete doc.claudeBudget;
			else doc.claudeBudget = value;
		});
		return this.snapshot();
	}
};
/** Environment override for the cap, in MB. */
const MULTIMODAL_ENV_VAR = "DSH_AGY_MULTIMODAL_MAX_INLINE_MB";
/**
* Rebuild the document, keeping only fields that are set.
*
* ONE place builds a document, so `parse`/`snapshot`/`write` cannot disagree
* about which fields exist: `thinking-budget.ts` spells its document out in each
* of the three, and a field added to only two of them is silently dropped by the
* third (that is why its `write` and `snapshot` both enumerate `claudeBudget`
* and `tieredBudget` by hand). `undefined` is dropped rather than serialized as
* `null`, so "unset" has exactly one on-disk form.
*/
function toDocument(doc) {
	return {
		version: 1,
		...doc.maxInlineMb === void 0 ? {} : { maxInlineMb: doc.maxInlineMb }
	};
}
/**
* Keep the stored value only when it is usable (tolerates hand edits).
*
* Dropped rather than clamped: a clamped cap would silently inline files the
* user asked to keep out, and the fallback — no stored value — is a valid state
* that simply means the built-in default.
*/
function sanitizeMultimodalDocument(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return toDocument({ version: 1 });
	const value = raw.maxInlineMb;
	return toDocument({
		version: 1,
		...isValidMultimodalMb(value) ? { maxInlineMb: value } : {}
	});
}
function parseMultimodalDocument(text) {
	let raw;
	try {
		raw = JSON.parse(text);
	} catch {
		return toDocument({ version: 1 });
	}
	return sanitizeMultimodalDocument(raw);
}
/**
* The env override, or undefined when unset or unusable.
*
* `DSH_AGY_*` rather than `AGY_*`: that prefix is this plugin's own runtime
* knobs (`risk.ts`'s kill switch and fingerprint mode, `plugin-common.ts`'s
* health-probe interval), while `AGY_CLIENT_ID`/`AGY_CLIENT_SECRET` are the
* OAuth client-credential namespace — a knob that changes request behavior
* belongs to the former.
*
* This is the codebase's first NUMERIC env knob, and it inherits `envFlag`'s
* posture: anything not recognized yields the fallback (here "no override")
* rather than throwing or warning, because the fallback chain (store, then
* default) is always a valid state. Recognized means a plain decimal integer —
* `30MB`, `1.5` and `1e2` are ignored rather than guessed at, so the value that
* takes effect is the one written.
*
* Read per call, not cached at module load, so a test (or a process that sets it
* late) sees the change without a restart.
*/
function envMaxInlineMb() {
	const raw = process.env[MULTIMODAL_ENV_VAR];
	if (raw === void 0) return void 0;
	const trimmed = raw.trim();
	if (!/^\d+$/.test(trimmed)) return void 0;
	const value = Number(trimmed);
	return isValidMultimodalMb(value) ? value : void 0;
}
/**
* In-memory authoritative copy of the cap, backed by a JSON file.
*
* `maxInlineBytes` sits on the GENERATION HOT PATH (the adapter resolves the cap
* for every request), so the cross-instance revalidation it needs is
* rate-limited — the same window, shared with `thinking-budget.ts` rather than
* re-declared: two settings read on one hot path should not drift into two
* different staleness bounds. Writes go to the file immediately and bypass the
* limit so a concurrent edit is never merged into a stale copy.
*
* No file lock: a settings write is atomic (tmp+rename) and the accepted loss is
* one concurrent toggle, which is the same trade `thinking-budget.ts` makes.
*/
var MultimodalConfigStore = class MultimodalConfigStore {
	file;
	revalidateIntervalMs;
	doc;
	/** Raw text this instance last read or wrote; see `reloadNow`. */
	raw;
	/** When `reloadNow` last ran, for the hot-path throttle. */
	checkedAt;
	constructor(options = {}) {
		this.file = options.file ?? migrateToAgyDir("agy-multimodal.json").file;
		this.revalidateIntervalMs = options.revalidateIntervalMs ?? 1e3;
		const initial = this.readWithRaw();
		this.doc = initial.doc;
		this.raw = initial.raw;
		this.checkedAt = Date.now();
	}
	/** Path of the backing file. */
	get path() {
		return this.file;
	}
	static serialize(doc) {
		return JSON.stringify(doc, null, 2) + "\n";
	}
	/**
	* Read the document together with the raw text it came from.
	*
	* Content, not mtime: two writers can land in the same filesystem timestamp
	* tick (Windows resolves it coarsely enough to have failed CI in this repo),
	* and a missed change is exactly the bug this check exists to prevent. A
	* missing or unreadable file means "nothing configured" — and must NOT create
	* it, because a settings read runs in processes that never write.
	*/
	readWithRaw() {
		try {
			const raw = readFileSync(this.file, "utf8");
			return {
				doc: parseMultimodalDocument(raw),
				raw
			};
		} catch {
			return {
				doc: toDocument({ version: 1 }),
				raw: ""
			};
		}
	}
	/**
	* Re-read the file if another writer changed it.
	*
	* Unconditional — callers on the hot path use `reloadIfChanged` instead.
	*/
	reloadNow() {
		let current;
		try {
			current = readFileSync(this.file, "utf8");
		} catch {
			current = "";
		}
		this.checkedAt = Date.now();
		if (current === this.raw) return;
		const fresh = this.readWithRaw();
		this.doc = fresh.doc;
		this.raw = fresh.raw;
	}
	/**
	* Hot-path revalidation: `reloadNow`, rate-limited.
	*
	* Without the limit every generation pays a blocking `readFileSync` plus a
	* UTF-8 decode for a value that changes only when a user saves the settings
	* card, so the worst case here is that a change takes up to
	* `revalidateIntervalMs` to reach an already-running adapter — the right trade
	* for a setting, and not right for the write path, which is why `write` calls
	* `reloadNow` directly.
	*/
	reloadIfChanged() {
		if (Date.now() - this.checkedAt < this.revalidateIntervalMs) return;
		this.reloadNow();
	}
	/**
	* Write the whole document atomically.
	*
	* Always re-reads first, so a concurrent edit by the OTHER instance in this
	* process (main plugin + web entry) is merged rather than overwritten: the
	* caller passes a mutation, not a full replacement built from a stale copy.
	*/
	write(mutate) {
		this.reloadNow();
		const next = toDocument(this.doc);
		mutate(next);
		const text = MultimodalConfigStore.serialize(next);
		mkdirSync(dirname(this.file), { recursive: true });
		const tmp = `${this.file}.tmp`;
		writeFileSync(tmp, text, { mode: 384 });
		renameSync(tmp, this.file);
		this.doc = next;
		this.raw = text;
	}
	/** The STORED cap in MB, or undefined when nothing is stored. */
	maxInlineMb() {
		this.reloadIfChanged();
		return this.doc.maxInlineMb;
	}
	/**
	* The cap actually in force: env overrides the stored value, which overrides
	* the built-in default.
	*
	* The env var is read HERE rather than at construction so the override is
	* live for a long-running process and flippable in a test.
	*/
	effectiveMaxInlineMb() {
		const fromEnv = envMaxInlineMb();
		if (fromEnv !== void 0) return {
			value: fromEnv,
			source: "env"
		};
		const stored = this.maxInlineMb();
		if (stored !== void 0) return {
			value: stored,
			source: "stored"
		};
		return {
			value: 20,
			source: "default"
		};
	}
	/** The effective cap in bytes, as the multimodal resolver wants it. */
	maxInlineBytes() {
		return this.effectiveMaxInlineMb().value * 1024 * 1024;
	}
	/**
	* The settings state: the stored value (null when unset) plus which source is
	* effective. See `MultimodalView` for why the two are separate fields.
	*/
	snapshot() {
		return {
			value: this.maxInlineMb() ?? null,
			source: this.effectiveMaxInlineMb().source,
			max: 100
		};
	}
	/** Replace the cap, or clear it when `value` is undefined. */
	setMaxInlineMb(value) {
		if (value !== void 0 && !isValidMultimodalMb(value)) throw new Error(`multimodal inline cap must be an integer in [1, 100] MB`);
		this.write((doc) => {
			if (value === void 0) delete doc.maxInlineMb;
			else doc.maxInlineMb = value;
		});
		return this.snapshot();
	}
};
//#endregion
//#region src/usage-types.ts
/** Zeroed counters, for accumulation. */
function zeroCounters() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		requests: 0,
		succeeded: 0,
		failed: 0,
		rateLimited: 0,
		rotations: 0,
		latencyMs: 0,
		latencyN: 0,
		ttftMs: 0,
		ttftN: 0
	};
}
function zeroAccount(now) {
	return {
		totals: zeroCounters(),
		models: {},
		sources: {
			chat: 0,
			cli: 0,
			verify: 0,
			test: 0
		},
		lastUsedAt: now
	};
}
function emptyDocument(now) {
	return {
		version: 2,
		since: now,
		totals: zeroCounters(),
		accounts: {},
		days: {}
	};
}
/** Local-time day key. Local (not UTC) so "today" matches the user's clock. */
function dayKey(time) {
	const d = new Date(time);
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${month}-${day}`;
}
/** Add `add` into `into`, in place. */
function addInto(into, add) {
	into.input += add.input;
	into.output += add.output;
	into.cacheRead += add.cacheRead;
	into.cacheWrite += add.cacheWrite;
	into.requests += add.requests;
	into.succeeded += add.succeeded;
	into.failed += add.failed;
	into.rateLimited += add.rateLimited;
	into.rotations += add.rotations;
	into.latencyMs += add.latencyMs;
	into.latencyN += add.latencyN;
	into.ttftMs += add.ttftMs;
	into.ttftN += add.ttftN;
}
/** Coerce arbitrary parsed JSON into a valid counter block (tolerates hand edits). */
function sanitizeCounters(raw) {
	const out = zeroCounters();
	if (typeof raw !== "object" || raw === null) return out;
	for (const key of Object.keys(out)) {
		const value = raw[key];
		if (typeof value === "number" && Number.isFinite(value) && value >= 0) out[key] = value;
	}
	return out;
}
function sanitizeAccount(raw, now) {
	const out = zeroAccount(now);
	if (typeof raw !== "object" || raw === null) return out;
	const record = raw;
	out.totals = sanitizeCounters(record.totals);
	if (typeof record.lastUsedAt === "number" && Number.isFinite(record.lastUsedAt)) out.lastUsedAt = record.lastUsedAt;
	if (typeof record.models === "object" && record.models !== null) for (const [id, value] of Object.entries(record.models)) out.models[id] = sanitizeCounters(value);
	if (typeof record.sources === "object" && record.sources !== null) for (const key of [
		"chat",
		"cli",
		"verify",
		"test"
	]) {
		const value = record.sources[key];
		if (typeof value === "number" && Number.isFinite(value) && value >= 0) out.sources[key] = value;
	}
	return out;
}
/** Parse a persisted document defensively; a corrupt file degrades to empty. */
function parseStatsDocument(text, now) {
	let raw;
	try {
		raw = JSON.parse(text);
	} catch {
		return emptyDocument(now);
	}
	if (typeof raw !== "object" || raw === null) return emptyDocument(now);
	const record = raw;
	const doc = emptyDocument(now);
	if (typeof record.since === "number" && Number.isFinite(record.since)) doc.since = record.since;
	doc.totals = sanitizeCounters(record.totals);
	if (typeof record.accounts === "object" && record.accounts !== null) for (const [key, value] of Object.entries(record.accounts)) doc.accounts[key] = sanitizeAccount(value, now);
	if (typeof record.days === "object" && record.days !== null) {
		for (const [key, value] of Object.entries(record.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(key)) doc.days[key] = sanitizeDayBucket(value);
	}
	return doc;
}
/**
* Coerce one day's stored value into a `DayBucket`.
*
* Accepts the version-1 shape too: that stored a bare counter block, so a
* document written before the upgrade keeps its day counts as `totals` with no
* breakdown. Losing the breakdown for those days is the correct trade — the
* alternative (dropping the days) would erase real history, and recomputing a
* dimension split that was never recorded is impossible. The all-time
* `accounts`/`models` maps are unaffected, so only range-scoped breakdown tables
* are thinner for pre-upgrade days.
*/
function sanitizeDayBucket(raw) {
	const out = {
		totals: zeroCounters(),
		models: {},
		accounts: {}
	};
	if (typeof raw !== "object" || raw === null) return out;
	const record = raw;
	if (typeof record.totals === "object" && record.totals !== null) {
		out.totals = sanitizeCounters(record.totals);
		if (typeof record.models === "object" && record.models !== null) for (const [id, value] of Object.entries(record.models)) out.models[id] = sanitizeCounters(value);
		if (typeof record.accounts === "object" && record.accounts !== null) for (const [key, value] of Object.entries(record.accounts)) out.accounts[key] = sanitizeCounters(value);
		return out;
	}
	out.totals = sanitizeCounters(raw);
	return out;
}
/** Drop day buckets older than the window; their counts already live in `totals`. */
function pruneDays(doc, now) {
	const cutoff = dayKey(now - 2592e6);
	for (const key of Object.keys(doc.days)) if (key < cutoff) delete doc.days[key];
}
/**
* Fold the day buckets for a window into the three views the Usage tab renders.
*
* The breakdown tables read THIS rather than the all-time `accounts`/`models`
* maps, so one range selection governs the whole page. Rows are sorted by
* request count descending, matching the all-time view; the caller re-sorts if
* it wants another order (the UI shows them as-is).
*
* @param doc - the ledger snapshot.
* @param days - window length in days, at least 1.
* @param now - current time (Unix ms).
* @returns totals and their per-model / per-account partitions.
*/
function foldWindowBreakdown(doc, days, now) {
	const cutoff = dayKey(now - (Math.max(1, Math.floor(days)) - 1) * 864e5);
	const totals = zeroCounters();
	const models = /* @__PURE__ */ new Map();
	const accounts = /* @__PURE__ */ new Map();
	for (const [key, bucket] of Object.entries(doc.days)) {
		if (key < cutoff) continue;
		addInto(totals, bucket.totals);
		for (const [model, counters] of Object.entries(bucket.models)) {
			const current = models.get(model);
			if (current === void 0) models.set(model, { ...counters });
			else addInto(current, counters);
		}
		for (const [account, counters] of Object.entries(bucket.accounts)) {
			const current = accounts.get(account);
			if (current === void 0) accounts.set(account, { ...counters });
			else addInto(current, counters);
		}
	}
	const byRequests = (a, b) => b.counters.requests - a.counters.requests;
	return {
		totals,
		models: [...models.entries()].map(([model, counters]) => ({
			model,
			counters
		})).sort(byRequests),
		accounts: [...accounts.entries()].map(([account, counters]) => ({
			account,
			counters
		})).sort(byRequests)
	};
}
/** Merge one record into a document, in place. Shared by the live store and tests. */
function applyRecord(doc, record, now) {
	const delta = zeroCounters();
	if (record.poolEvent !== true) {
		delta.requests = 1;
		if (record.ok) delta.succeeded = 1;
		else delta.failed = 1;
		if (record.rateLimited === true) delta.rateLimited = 1;
	}
	if (record.rotated === true) delta.rotations = 1;
	if (record.usage !== void 0) {
		delta.input = record.usage.input;
		delta.output = record.usage.output;
		delta.cacheRead = record.usage.cacheRead;
		delta.cacheWrite = record.usage.cacheWrite;
	}
	if (typeof record.latencyMs === "number" && Number.isFinite(record.latencyMs) && record.latencyMs >= 0) {
		delta.latencyMs = record.latencyMs;
		delta.latencyN = 1;
	}
	if (typeof record.ttftMs === "number" && Number.isFinite(record.ttftMs) && record.ttftMs >= 0) {
		delta.ttftMs = record.ttftMs;
		delta.ttftN = 1;
	}
	addInto(doc.totals, delta);
	if (record.account !== void 0 && record.account !== "") {
		const account = doc.accounts[record.account] ?? zeroAccount(now);
		addInto(account.totals, delta);
		if (record.poolEvent !== true) account.sources[record.source] += 1;
		account.lastUsedAt = now;
		if (record.model !== void 0 && record.model !== "") {
			const model = account.models[record.model] ?? zeroCounters();
			addInto(model, delta);
			account.models[record.model] = model;
		}
		doc.accounts[record.account] = account;
	}
	const key = dayKey(now);
	const bucket = doc.days[key] ?? {
		totals: zeroCounters(),
		models: {},
		accounts: {}
	};
	addInto(bucket.totals, delta);
	if (record.model !== void 0 && record.model !== "") {
		const model = bucket.models[record.model] ?? zeroCounters();
		addInto(model, delta);
		bucket.models[record.model] = model;
	}
	if (record.account !== void 0 && record.account !== "") {
		const account = bucket.accounts[record.account] ?? zeroCounters();
		addInto(account, delta);
		bucket.accounts[record.account] = account;
	}
	doc.days[key] = bucket;
	pruneDays(doc, now);
}
const properStatsLock = { withLock(file, fn) {
	const release = lockfile.lockSync(file, {
		stale: 8e3,
		update: 4e3,
		realpath: false
	});
	try {
		return fn();
	} finally {
		release();
	}
} };
/**
* Accumulating usage ledger. `record()` is the hot path and performs no I/O:
* it folds the record into an in-memory delta. `flush()` merges that delta into
* the persisted document under the file lock.
*/
var UsageStats = class {
	file;
	lock;
	now;
	flushEvery;
	flushIntervalMs;
	maxPending;
	onFlushError;
	persistRecent;
	/** This process's un-flushed records. */
	pending = [];
	timer;
	lastFlushError;
	/**
	* Whether the current run of consecutive failures has already been reported.
	* Count-based flushing is also suspended while set: see `record()`.
	*/
	flushFailedSince;
	constructor(options = {}) {
		this.file = options.file ?? migrateToAgyDir("agy-stats.json").file;
		this.lock = options.lock ?? properStatsLock;
		this.now = options.now ?? (() => Date.now());
		this.flushEvery = options.flushEvery ?? 50;
		this.flushIntervalMs = options.flushIntervalMs ?? 5e3;
		this.maxPending = options.maxPending ?? 500;
		this.onFlushError = options.onFlushError;
		this.persistRecent = options.persistRecent;
	}
	/** Path of the backing file. */
	get path() {
		return this.file;
	}
	/**
	* Pre-create the ledger so `proper-lockfile` can lock it. The lock throws
	* ENOENT on a nonexistent target, so the empty document must exist (0600,
	* tmp+rename) before the first flush.
	*/
	ensureFile(now) {
		if (existsSync(this.file)) return;
		mkdirSync(dirname(this.file), { recursive: true });
		const tmp = `${this.file}.tmp-init`;
		writeFileSync(tmp, JSON.stringify(emptyDocument(now), null, 2) + "\n", { mode: 384 });
		renameSync(tmp, this.file);
	}
	readFile() {
		const now = this.now();
		try {
			return parseStatsDocument(readFileSync(this.file, "utf8"), now);
		} catch {
			return emptyDocument(now);
		}
	}
	/** Atomic replace (tmp + rename), owner-only, so a reader never sees a partial file. */
	writeFile(doc) {
		mkdirSync(dirname(this.file), { recursive: true });
		const tmp = `${this.file}.tmp`;
		writeFileSync(tmp, JSON.stringify(doc, null, 2) + "\n", { mode: 384 });
		renameSync(tmp, this.file);
	}
	/** Record one request. Hot path: no I/O. */
	record(record) {
		this.noteRecent(record);
		this.pending.push(record);
		if (this.maxPending > 0 && this.pending.length > this.maxPending) this.pending.splice(0, this.pending.length - this.maxPending);
		if (this.flushFailedSince === void 0 && this.flushEvery > 0 && this.pending.length >= this.flushEvery) {
			this.flush();
			return;
		}
		this.armTimer();
	}
	/**
	* The in-memory recent-activity ring, persisted by an injected
	* `RecentActivityStore` when one is supplied.
	*
	* The ring itself stays in-memory and I/O-free — `noteRecent` only flattens —
	* while the OPTIONAL `persistRecent` seam hands each flattened record to
	* `recent-store.ts`, which owns the file, the triggers, the lock, and the
	* failure story. When no store is injected (tests, the CLI) the ring behaves
	* exactly as before: per-process, never persisted.
	*
	* An earlier revision recorded why persistence was rejected outright (file
	* growth, a versioned migration, a wider stored surface); `recent-store.ts`
	* answers each — a bounded list in its own file, no version field, emails
	* and model ids only — which is what turned this from a bad idea into a
	* spec.
	*/
	recent = [];
	noteRecent(record) {
		const entry = {
			at: this.now(),
			account: record.account ?? null,
			model: record.model ?? null,
			...record.actualModel !== void 0 ? { actualModel: record.actualModel } : {},
			kind: record.poolEvent === true ? "rotation" : record.source,
			ok: record.ok === true,
			rateLimited: record.rateLimited === true,
			latencyMs: record.latencyMs ?? null,
			ttftMs: record.ttftMs ?? null,
			output: record.usage?.output ?? null,
			reason: record.ok === true ? null : record.reason ?? null
		};
		this.recent.push(entry);
		if (this.recent.length > 200) this.recent.splice(0, this.recent.length - 200);
		try {
			this.persistRecent?.(entry);
		} catch {}
	}
	/**
	* Newest-first copy of the ring, for the `pool.recent` RPC.
	*
	* A copy, not the live array: the RPC layer may hold it across awaits while
	* `record()` keeps pushing.
	*/
	recentRequests() {
		return [...this.recent].reverse();
	}
	armTimer() {
		if (this.timer !== void 0 || this.flushIntervalMs <= 0) return;
		this.timer = setTimeout(() => {
			this.timer = void 0;
			this.flush();
		}, this.flushIntervalMs);
		this.timer.unref?.();
	}
	/**
	* Merge pending records into the persisted document.
	*
	* Under the lock, the fresh on-disk state is re-read and this process's
	* records are replayed onto it. That is what keeps concurrently-running
	* writers (Desktop, a web-profile server, a CLI invocation) from clobbering
	* each other: a plain overwrite of the in-memory document would drop every
	* count another process added since this one loaded the file.
	*/
	flush() {
		if (this.timer !== void 0) {
			clearTimeout(this.timer);
			this.timer = void 0;
		}
		const batch = this.pending;
		if (batch.length === 0) return;
		this.pending = [];
		const now = this.now();
		try {
			this.ensureFile(now);
			this.lock.withLock(this.file, () => {
				const doc = this.readFile();
				for (const record of batch) applyRecord(doc, record, now);
				this.writeFile(doc);
			});
			this.lastFlushError = void 0;
			this.flushFailedSince = void 0;
		} catch (error) {
			this.pending = [...batch, ...this.pending];
			if (this.maxPending > 0 && this.pending.length > this.maxPending) this.pending.splice(0, this.pending.length - this.maxPending);
			this.lastFlushError = error;
			if (this.flushFailedSince === void 0) {
				this.flushFailedSince = now;
				try {
					this.onFlushError?.(error);
				} catch {}
			}
			this.armTimer();
		}
	}
	/** Flush if anything is pending; safe to call on turn end and process exit. */
	flushSync() {
		this.flush();
	}
	/**
	* A snapshot for reading (the Usage tab).
	*
	* Reads the file rather than an in-memory copy: the writer is not always this
	* process. A CLI `login`/`verify` runs in its own process, and the browser may
	* be served by a different plugin instance than the one that generated, so an
	* in-memory cache would show a stale or empty ledger. This process's own
	* un-flushed records are layered on top so the UI never lags behind its own
	* activity.
	*
	* Called once per UI open/refresh, never on the generation hot path, so the
	* read is cheap enough.
	*/
	snapshot() {
		const now = this.now();
		const doc = this.readFile();
		if (this.pending.length > 0) for (const record of this.pending) applyRecord(doc, record, now);
		return doc;
	}
	/** The most recent flush failure, if any (diagnostics). */
	get flushError() {
		return this.lastFlushError;
	}
	/** Number of records awaiting flush. */
	get pendingCount() {
		return this.pending.length;
	}
	/** Whether the ledger is currently failing to persist (a run of failures). */
	get flushFailing() {
		return this.flushFailedSince !== void 0;
	}
};
/** Capture-key dedupe: the fields two processes writing the same capture share. */
function captureKey(entry) {
	return `${entry.at}|${entry.account ?? ""}|${entry.model ?? ""}|${entry.kind}|${entry.output ?? ""}`;
}
/**
* Coerce one parsed JSON value into a `RecentActivity`, or null when it is not
* one. No version field: a record this build cannot parse is dropped, which
* for a bounded diagnostics list is the whole migration story.
*/
function parseRecentActivity(raw) {
	if (typeof raw !== "object" || raw === null) return null;
	const r = raw;
	const kinds = [
		"chat",
		"cli",
		"verify",
		"test",
		"rotation"
	];
	if (typeof r.at !== "number" || !Number.isFinite(r.at)) return null;
	if (!kinds.includes(r.kind)) return null;
	if (typeof r.ok !== "boolean") return null;
	const nullableString = (v) => typeof v === "string" && v.length > 0 ? v : null;
	const nullableNumber = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
	return {
		at: r.at,
		account: nullableString(r.account),
		model: nullableString(r.model),
		actualModel: nullableString(r.actualModel),
		kind: r.kind,
		ok: r.ok,
		rateLimited: r.rateLimited === true,
		latencyMs: nullableNumber(r.latencyMs),
		ttftMs: nullableNumber(r.ttftMs),
		output: nullableNumber(r.output),
		reason: nullableString(r.reason)
	};
}
/** Merge one batch into an on-disk list (pure; the caller owns the lock and the write). */
function mergeRecentEntries(onDisk, batch, cap = 200) {
	const byKey = /* @__PURE__ */ new Map();
	for (const entry of [...onDisk, ...batch]) byKey.set(captureKey(entry), entry);
	return [...byKey.values()].sort((a, b) => a.at - b.at).slice(-cap);
}
const properRecentLock = { withLock(file, fn) {
	const release = lockfile.lockSync(file, {
		stale: 8e3,
		update: 4e3,
		realpath: false
	});
	try {
		return fn();
	} finally {
		release();
	}
} };
/**
* Persists the recent-activity ring across processes and restarts.
*
* The plugin constructs it BEFORE any record can arrive, seeds the in-memory
* ring from the file, and hands it to `UsageStats` as the persistence half;
* `record()` in `UsageStats` stays I/O-free — it appends to this store's
* pending list, and flushing happens on the triggers above.
*/
var RecentActivityStore = class {
	file;
	lock;
	now;
	flushEvery;
	flushIntervalMs;
	onFlushError;
	/** The seeded ring plus this process's un-flushed captures. */
	entries = [];
	pending = [];
	timer;
	flushFailedSince;
	lastFlushError;
	constructor(options = {}) {
		this.file = options.file ?? migrateToAgyDir("agy-recent.json").file;
		this.lock = options.lock ?? properRecentLock;
		this.now = options.now ?? (() => Date.now());
		this.flushEvery = options.flushEvery ?? 25;
		this.flushIntervalMs = options.flushIntervalMs ?? 3e4;
		this.onFlushError = options.onFlushError;
		try {
			const parsed = JSON.parse(readFileSync(this.file, "utf8"));
			if (Array.isArray(parsed)) {
				for (const raw of parsed) {
					const entry = parseRecentActivity(raw);
					if (entry) this.entries.push(entry);
				}
				if (this.entries.length > 200) this.entries.splice(0, this.entries.length - 200);
			}
		} catch {}
	}
	/** Path of the backing file. */
	get path() {
		return this.file;
	}
	/** Whether the ring is currently failing to persist (a run of failures). */
	get flushFailing() {
		return this.flushFailedSince !== void 0;
	}
	/** Number of records awaiting flush. */
	get pendingCount() {
		return this.pending.length;
	}
	/**
	* Capture one flattened record and the I/O-free hot-path append.
	*
	* `UsageStats.record()` calls this after folding into its own ring; keeping
	* the write-behind state HERE (not in UsageStats) is what lets the file have
	* its own triggers, its own lock, and its own failure story without widening
	* the ledger's.
	*/
	capture(entry) {
		this.entries.push(entry);
		if (this.entries.length > 200) this.entries.splice(0, this.entries.length - 200);
		this.pending.push(entry);
		if (this.flushEvery > 0 && this.pending.length >= this.flushEvery) {
			this.flush();
			return;
		}
		this.armTimer();
	}
	/**
	* Newest-first copy of the ring, for the `pool.recent` RPC: the seeded
	* history plus everything this process captured since boot.
	*/
	recentRequests() {
		return [...this.entries].reverse();
	}
	armTimer() {
		if (this.timer !== void 0 || this.flushIntervalMs <= 0) return;
		this.timer = setTimeout(() => {
			this.timer = void 0;
			this.flush();
		}, this.flushIntervalMs);
		this.timer.unref?.();
	}
	/**
	* Merge pending captures into the persisted file.
	*
	* Same merge discipline as the ledger: re-read under the lock, merge by
	* capture key (two processes replaying the same window must not duplicate
	* rows), sort by time, cap. A failed flush puts the batch back — a
	* diagnostics ring never breaks a generation — and reports once per run.
	*/
	flush() {
		if (this.timer !== void 0) {
			clearTimeout(this.timer);
			this.timer = void 0;
		}
		const batch = this.pending;
		if (batch.length === 0) return;
		this.pending = [];
		const now = this.now();
		try {
			if (!existsSync(this.file)) {
				mkdirSync(dirname(this.file), { recursive: true });
				writeFileSync(this.file, "[]\n", { mode: 384 });
			}
			this.lock.withLock(this.file, () => {
				const onDisk = [];
				try {
					const parsed = JSON.parse(readFileSync(this.file, "utf8"));
					if (Array.isArray(parsed)) for (const raw of parsed) {
						const entry = parseRecentActivity(raw);
						if (entry) onDisk.push(entry);
					}
				} catch {}
				const merged = mergeRecentEntries(onDisk, batch);
				const tmp = `${this.file}.tmp`;
				writeFileSync(tmp, JSON.stringify(merged, null, 2) + "\n", { mode: 384 });
				renameSync(tmp, this.file);
			});
			this.lastFlushError = void 0;
			this.flushFailedSince = void 0;
		} catch (error) {
			this.pending = [...batch, ...this.pending];
			this.lastFlushError = error;
			if (this.flushFailedSince === void 0) {
				this.flushFailedSince = now;
				try {
					this.onFlushError?.(error);
				} catch {}
			}
			this.armTimer();
		}
	}
	/** Flush if anything is pending; called on process exit. */
	flushSync() {
		this.flush();
	}
	/** The most recent flush failure, if any (diagnostics). */
	get flushError() {
		return this.lastFlushError;
	}
};
//#endregion
//#region src/plugin-common.ts
/**
* Shared runtime construction for the in-harness plugin entries: master-key
* codec resolution (credentials seam first, credentials document fallback),
* account store, session manager, and adapter. Used by the main plugin
* (adapter registration) and the web plugin (route registration) so both
* entries operate on the same store.
*/
function codecFrom(masterKey) {
	return createAesGcmCodec(deriveKey(masterKey));
}
/** Resolve or create the master key, preferring the credentials seam when available. */
async function resolveCodec(ctx) {
	const dshHome = resolveDshHome();
	const credentials = ctx.get("credentials");
	if (credentials) {
		const resolved = await credentials.resolve(MASTER_KEY_REF);
		if (resolved) return {
			codec: codecFrom(resolved.value),
			created: false
		};
		const fileKey = loadMasterKey(dshHome);
		if (fileKey) return {
			codec: codecFrom(fileKey),
			created: false
		};
		const fresh = randomBytes(32).toString("hex");
		try {
			await credentials.set(MASTER_KEY_REF, fresh);
			return {
				codec: codecFrom(fresh),
				created: true
			};
		} catch {
			persistMasterKey(dshHome, fresh);
			return {
				codec: codecFrom(fresh),
				created: true
			};
		}
	}
	return resolveMasterKeyCodec(dshHome);
}
/**
* Fire-and-forget version warm-up so fingerprint generation inside the
* rate-limit path never waits on a cold feed.
*
* Routed through `pickProbeProxyUrl`: the release feeds are not account-scoped,
* but the host IP is exactly what a per-account-proxy user asked to hide, and a
* bare `proxiedFetch` sends this boot-time request directly. Never throws — an
* unreadable store or a dead feed must not be the reason plugin boot fails.
*/
async function warmVersionCache(store) {
	let fetchImpl = proxiedFetch;
	try {
		const storage = await store.load();
		const proxyUrl = pickProbeProxyUrl(storage.accounts, storage.activeIndex);
		fetchImpl = probeFetch(proxyUrl);
	} catch {}
	await resolveAntigravityVersion(fetchImpl).catch(() => {});
}
/**
* The process-wide runtime promise, shared by both entry points.
*
* Splitting it was a real defect, not a stylistic one: the ledger FILE merges
* across instances, so counters looked fine, but every in-memory surface is
* per instance — the web entry's ring and in-flight map could never see the
* main plugin's chat traffic (same process, two rings), and `account.activate`
* cleared affinity pins on the WRONG session manager while the serving one
* kept its stale pin. Both entries call this in one process; one memo here is
* what makes that "shared runtime" claim true. Separate profiles are separate
* processes, so the memo never bridges compositions.
*/
let sharedRuntime;
/** Build (once per process) and return the runtime both entries share. */
async function createAgyRuntime(ctx) {
	if (sharedRuntime === void 0) sharedRuntime = buildAgyRuntime(ctx).catch((error) => {
		sharedRuntime = void 0;
		throw error;
	});
	return sharedRuntime;
}
async function buildAgyRuntime(ctx) {
	const { codec } = await resolveCodec(ctx);
	const dshHome = resolveDshHome();
	const accountsMigrated = migrateToAgyDir("agy-accounts.json", dshHome);
	if (accountsMigrated.skew) ctx.logger.warn("[dsh-agy] legacy data file detected next to the agy folder — an older dsh-agy process may still be writing the pre-0.5 layout; its writes will not be seen until every dsh surface is restarted");
	const store = new JsonAccountStore({
		file: accountsMigrated.file,
		codec
	});
	warmVersionCache(store);
	const recentStore = new RecentActivityStore({ onFlushError: (error) => {
		ctx.logger.warn(`[dsh-agy] recent-activity file could not be written (${recentStore.path}): ${error instanceof Error ? error.message : String(error)} — entries are buffered and will retry`);
	} });
	const stats = new UsageStats({
		persistRecent: (entry) => {
			recentStore.capture(entry);
		},
		onFlushError: (error) => {
			ctx.logger.warn(`[dsh-agy] usage ledger could not be written (${stats.path}): ${error instanceof Error ? error.message : String(error)} — counts are buffered and will retry`);
		}
	});
	const modelVisibility = new ModelVisibility();
	const thinkingBudget = new ThinkingBudgetStore();
	const multimodalConfig = new MultimodalConfigStore();
	let invalidateModelCache = () => {};
	const sessions = new AgySessionManager({
		store,
		recordUsage: (record) => {
			stats.record(record);
		},
		onRotate: () => {
			invalidateModelCache();
		}
	});
	const healthIntervalMs = Number(process.env.DSH_AGY_HEALTH_INTERVAL_MS ?? 0);
	if (Number.isFinite(healthIntervalMs) && healthIntervalMs > 0) sessions.startHealthProbe(healthIntervalMs);
	const adapter = new AgyAdapter({
		getSession: (model, conversationKey) => sessions.getSession(model, void 0, conversationKey),
		reportFailure: (kind, session, info) => sessions.reportFailure(kind, session, info),
		markSuccess: (session) => sessions.markSuccess(session),
		resolveAttachments: () => ctx.get("attachments"),
		noteRequestStarted: (account) => sessions.noteRequestStarted(account),
		noteRequestSettled: (account) => sessions.noteRequestSettled(account),
		modelVisibility,
		thinkingBudgetFor: (level) => thinkingBudget.budgetFor(level),
		claudeBudgetFor: () => thinkingBudget.claudeBudget(),
		tieredBudgetFor: () => thinkingBudget.tieredBudget(),
		maxInlineBytes: () => multimodalConfig.maxInlineBytes(),
		recordUsage: (record) => {
			stats.record({
				...record,
				source: "chat"
			});
		}
	});
	invalidateModelCache = () => {
		adapter.invalidateModelCache();
	};
	adapter.listAllModels().catch(() => {});
	process.once("exit", () => {
		stats.flushSync();
		recentStore.flushSync();
	});
	return {
		store,
		sessions,
		adapter,
		stats,
		recentStore,
		modelVisibility,
		thinkingBudget,
		multimodalConfig
	};
}
//#endregion
export { CLAUDE_BUDGET_MIN as a, CLAUDE_BUDGET_MAX as i, dayKey as n, THINKING_BUDGET_MAX as o, foldWindowBreakdown as r, createAgyRuntime as t };

//# sourceMappingURL=plugin-common-DLpF5A04.mjs.map