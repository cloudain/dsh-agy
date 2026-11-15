import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import * as DshLlm from "@deepseek-ai/dsh-llm";
//#region src/adapter/parse.ts
var parse_exports = /* @__PURE__ */ __exportAll({
	AgyStreamIdleTimeoutError: () => AgyStreamIdleTimeoutError,
	DEFAULT_STREAM_IDLE_TIMEOUT_MS: () => DEFAULT_STREAM_IDLE_TIMEOUT_MS,
	UnmappedFinishReasonError: () => UnmappedFinishReasonError,
	parseAgySse: () => parseAgySse,
	parseSseDataLine: () => parseSseDataLine,
	resolveStreamIdleTimeoutMs: () => resolveStreamIdleTimeoutMs
});
const CallId = DshLlm.ToolCallId ?? DshLlm.CallId;
if (!CallId) throw new Error("dsh-llm: neither ToolCallId nor CallId found");
/**
* Parse one SSE `data:` line; returns null for `[DONE]` or empty lines.
* Accepts the `{"response": {...}}` envelope (daily endpoint wire shape) and
* the bare array/object shapes older clients emitted.
*/
function parseSseDataLine(line) {
	const trimmed = line.trim();
	if (!trimmed.startsWith("data:")) return null;
	const data = trimmed.slice(5).trim();
	if (data === "" || data === "[DONE]") return null;
	const parsed = JSON.parse(data);
	const root = parsed?.response ?? parsed;
	const payload = Array.isArray(root) ? root[0] : root;
	if (!payload || typeof payload !== "object") return null;
	const modelVersion = root?.modelVersion ?? parsed?.modelVersion ?? payload.modelVersion;
	if (typeof modelVersion === "string" && modelVersion.length > 0) payload.modelVersion = modelVersion;
	return payload;
}
/**
* Extract an error body from a line that does not carry the SSE `data:`
* prefix. The upstream occasionally drops its `{"error":{...}}` vocabulary as
* a bare JSON line right before terminating the stream — the socket closes
* cleanly and nothing else surfaces the failure. Returns null for anything
* that is not a JSON object carrying an `error` object; SSE comments and
* event/id/retry fields stay skipped.
*/
function extractBareJsonError(line) {
	const trimmed = line.trim();
	if (!trimmed.startsWith("{")) return null;
	try {
		const parsed = JSON.parse(trimmed);
		if (parsed.error && typeof parsed.error === "object") return parsed.error;
	} catch {}
	return null;
}
/**
* Thrown when the upstream ends a stream with a `finishReason` this parser
* does not map (SAFETY, RECITATION, MALFORMED_FUNCTION_CALL, ...). A silent
* default to `stop` presented policy-blocked and malformed-call turns as
* completed. This is a CONTENT-level verdict, not account health: the adapter
* reports it as `request-error` (no cooldown, no rotation), never
* `network-error`.
*/
var UnmappedFinishReasonError = class extends Error {
	reason;
	constructor(reason) {
		super(`agy upstream ended the stream with unrecognized finishReason: ${reason}`);
		this.reason = reason;
		this.name = "UnmappedFinishReasonError";
	}
};
/**
* Thrown when the SSE body produces no bytes for longer than the idle timeout.
*
* The streaming dispatcher deliberately runs with `bodyTimeout: 0` (a reasoning
* pause must not be killed mid-turn), so a connection that stops producing
* bytes without ever closing has no transport-level reclaim: the read simply
* never settles and the turn hangs until the user cancels it. The watchdog
* exists only for that shape.
*/
var AgyStreamIdleTimeoutError = class extends Error {
	idleTimeoutMs;
	constructor(idleTimeoutMs) {
		super(idleTimeoutMs >= 1e3 ? `agy stream idle timeout: no data received for ${Math.round(idleTimeoutMs / 1e3)}s` : `agy stream idle timeout: no data received for ${idleTimeoutMs}ms`);
		this.idleTimeoutMs = idleTimeoutMs;
		this.name = "AgyStreamIdleTimeoutError";
	}
};
/** Silence budget for one body read before the stream is declared stalled. */
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 18e4;
/**
* Resolve the idle timeout from `DSH_AGY_IDLE_TIMEOUT_MS` (or the `AGY_IDLE_TIMEOUT_MS` alias).
* Deliberately generous: measured reasoning gaps on a real tunnel reach ~35s, so the default is
* ~5x that and only a connection that has genuinely stopped trips it. `0` disables the watchdog;
* negative or non-numeric values fall back to the default rather than silently disabling it.
*/
function resolveStreamIdleTimeoutMs() {
	const dsh = process.env.DSH_AGY_IDLE_TIMEOUT_MS?.trim();
	const agy = process.env.AGY_IDLE_TIMEOUT_MS?.trim();
	const raw = dsh && dsh.length > 0 ? dsh : agy && agy.length > 0 ? agy : void 0;
	if (raw === void 0) return DEFAULT_STREAM_IDLE_TIMEOUT_MS;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_STREAM_IDLE_TIMEOUT_MS;
	return parsed;
}
/**
* Map the upstream `finishReason` vocabulary onto DSH's. WHITELIST, not
* blacklist: the completable reasons map to their kinds and every other
* explicit reason throws. `FINISH_REASON_UNSPECIFIED` is granted `stop` — it
* carries no information, exactly like the absent field.
*/
function mapFinishReason(reason) {
	switch (reason) {
		case "MAX_TOKENS": return { kind: "max-tokens" };
		case "STOP":
		case "FINISH_REASON_UNSPECIFIED": return { kind: "stop" };
		case "TOOL_CALLS":
		case "FUNCTION_CALL": return { kind: "tool-calls" };
		default: throw new UnmappedFinishReasonError(reason);
	}
}
/**
* Await one body read, failing after `timeoutMs` of silence (0 = no watchdog)
* or as soon as `signal` aborts.
*
* The timer measures the GAP between reads, so any byte resets it: a slow but
* live generation is untouched, while a connection that died without closing —
* or an upstream that accepted the request and then went away — fails instead
* of hanging forever. The abort leg exists for the same reason: without it a
* cancelled turn keeps waiting out the whole idle window, because the read loop
* only checks `signal.aborted` BETWEEN reads.
*
* Each abandonment rejects BEFORE cancelling the reader, and the order is
* load-bearing (measured on undici 7 and synthetic streams): the rejection is
* what settles this race — `reader.cancel()` settles the outstanding read only
* on a later turn — while the cancel reclaims the connection the streaming
* dispatcher (`bodyTimeout: 0`) would otherwise leave pinned. The abandoned
* read rejects with the release error once the caller's `finally` drops the
* lock, and `Promise.race` is what keeps that rejection handled.
*/
async function readWithIdleTimeout(reader, timeoutMs, signal) {
	const pending = reader.read();
	if (timeoutMs <= 0 && signal === void 0) return pending;
	let timer;
	let onAbort;
	const watchdog = new Promise((_resolve, reject) => {
		const abandon = (error) => {
			reject(error);
			reader.cancel(error).catch(() => {});
		};
		if (signal?.aborted) {
			abandon(new DOMException("aborted", "AbortError"));
			return;
		}
		if (timeoutMs > 0) timer = setTimeout(() => abandon(new AgyStreamIdleTimeoutError(timeoutMs)), timeoutMs);
		if (signal) {
			onAbort = () => abandon(new DOMException("aborted", "AbortError"));
			signal.addEventListener("abort", onAbort, { once: true });
		}
	});
	try {
		return await Promise.race([pending, watchdog]);
	} finally {
		if (timer !== void 0) clearTimeout(timer);
		if (signal && onAbort) signal.removeEventListener("abort", onAbort);
	}
}
async function* parseAgySse(body, options = {}) {
	const { signal, idleTimeoutMs = resolveStreamIdleTimeoutMs(), disambiguateToolCallIds = false } = options;
	const streamSalt = disambiguateToolCallIds ? Math.random().toString(36).slice(2, 8) : "";
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let blockIndex = 0;
	let finishReason = { kind: "stop" };
	let sawDone = false;
	let sawFinishReason = false;
	let sawUsage = false;
	let lastUsage = null;
	let open = null;
	const closeBlock = () => {
		if (!open) return null;
		const block = open.kind === "tool-call" ? {
			type: "block-end",
			index: blockIndex,
			block: {
				type: "tool-call",
				id: CallId(open.id ?? `call-${blockIndex}`),
				name: open.name ?? "",
				arguments: open.arguments
			}
		} : {
			type: "block-end",
			index: blockIndex,
			block: {
				type: open.kind,
				text: open.text
			}
		};
		open = null;
		blockIndex += 1;
		return block;
	};
	/**
	* Ensure a block of the given kind is open, switching when needed.
	* Returns chunks to yield (a closed block's end, then the new block's start).
	* Callers MUST yield everything returned — dropping the end silently corrupts
	* the block stream for DSH (verified: multi-tool turns and text→tool
	* transitions lost their block-end).
	*/
	const ensureBlock = (kind, meta = {}) => {
		const out = [];
		if (open && open.kind !== kind) {
			const end = closeBlock();
			if (end) out.push(end);
		}
		if (!open) {
			open = {
				kind,
				arguments: "",
				text: "",
				id: meta.id,
				name: meta.name
			};
			const blockType = kind === "tool-call" ? "tool-call" : kind;
			out.push({
				type: "block-start",
				index: blockIndex,
				blockType
			});
		}
		return out;
	};
	/**
	* Handle one wire line and return the chunks to yield. Shared by the read
	* loop and the EOF residual so a final line without a trailing newline is
	* processed exactly like a newline-terminated one — dropping it would lose
	* content AND, since the completeness guard landed, falsify a premature
	* termination on streams that end bare.
	*/
	const handleLine = (line) => {
		const out = [];
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) {
			const bare = extractBareJsonError(trimmed);
			if (bare) {
				const message = bare.message ?? bare.status ?? "upstream error";
				throw new Error(`agy stream error (${bare.code ?? "unknown"}): ${message}`);
			}
			return out;
		}
		if (trimmed.slice(5).trim() === "[DONE]") {
			sawDone = true;
			return out;
		}
		const payload = parseSseDataLine(trimmed);
		if (!payload) return out;
		if (payload.modelVersion) options.onModelVersion?.(payload.modelVersion);
		if (payload.error) {
			const message = payload.error.message ?? payload.error.status ?? "upstream error";
			throw new Error(`agy stream error (${payload.error.code ?? "unknown"}): ${message}`);
		}
		if (payload.usageMetadata) {
			sawUsage = true;
			const promptTokens = payload.usageMetadata.promptTokenCount ?? 0;
			const cachedTokens = payload.usageMetadata.cachedContentTokenCount ?? 0;
			lastUsage = {
				inputTokens: Math.max(0, promptTokens - cachedTokens),
				outputTokens: payload.usageMetadata.candidatesTokenCount ?? 0,
				cacheReadTokens: cachedTokens
			};
		}
		for (const candidate of payload.candidates ?? []) {
			if (candidate.finishReason) {
				sawFinishReason = true;
				finishReason = mapFinishReason(candidate.finishReason);
			}
			for (const part of candidate.content?.parts ?? []) {
				if (part.text === "" && !part.functionCall) continue;
				if (part.text !== void 0 && part.thought !== true) {
					out.push(...ensureBlock("text"));
					open.text += part.text;
					out.push({
						type: "text-delta",
						index: blockIndex,
						text: part.text
					});
				} else if (part.text !== void 0 && part.thought === true) {
					out.push(...ensureBlock("reasoning"));
					open.text += part.text;
					out.push({
						type: "reasoning-delta",
						index: blockIndex,
						text: part.text
					});
				} else if (part.functionCall) {
					const baseId = part.functionCall.id || String(blockIndex);
					const upstreamId = disambiguateToolCallIds && /^(call_[0-9]+|[0-9]+)$/.test(baseId) ? `${baseId}_${streamSalt}` : baseId;
					if (open) {
						const end = closeBlock();
						if (end) out.push(end);
					}
					const start = ensureBlock("tool-call", {
						id: upstreamId,
						name: part.functionCall.name
					});
					out.push(...start);
					if (part.thoughtSignature) options.onToolSignature?.(upstreamId, part.thoughtSignature);
					const argsJson = typeof part.functionCall.args === "string" ? part.functionCall.args : JSON.stringify(part.functionCall.args ?? {});
					open.arguments += argsJson;
					out.push({
						type: "tool-call-delta",
						index: blockIndex,
						id: CallId(open.id ?? ""),
						name: open.name,
						argumentsDelta: argsJson
					});
				}
			}
		}
		return out;
	};
	/**
	* Yield one line's chunks, but flush the stashed usage first if the line
	* aborts the stream.
	*
	* An unmapped `finishReason` throws from inside `handleLine`, i.e. BEFORE the
	* usageMetadata stash on that same line AND before the end-of-stream usage
	* chunk below. Without this the caller sees no usage at all for an attempt
	* that the upstream really did bill — and the adapter's `MALFORMED_FUNCTION_CALL`
	* re-sample discards exactly such an attempt, so its tokens would silently
	* never reach the ledger (AGENTS.md: the ledger accumulates per attempt).
	*/
	const drainLine = function* (line) {
		try {
			yield* handleLine(line);
		} catch (error) {
			if (error instanceof UnmappedFinishReasonError && lastUsage !== null) yield {
				type: "usage",
				usage: lastUsage
			};
			throw error;
		}
	};
	try {
		while (true) {
			if (signal?.aborted) {
				if (lastUsage !== null) yield {
					type: "usage",
					usage: lastUsage
				};
				throw new DOMException("aborted", "AbortError");
			}
			let read;
			try {
				read = await readWithIdleTimeout(reader, idleTimeoutMs, signal);
			} catch (error) {
				const isTimeout = error instanceof AgyStreamIdleTimeoutError;
				const isAbort = error instanceof DOMException && error.name === "AbortError";
				if ((isTimeout || isAbort) && lastUsage !== null) yield {
					type: "usage",
					usage: lastUsage
				};
				throw error;
			}
			if (read.done) break;
			buffer += decoder.decode(read.value, { stream: true });
			let newlineIndex;
			while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
				const line = buffer.slice(0, newlineIndex);
				buffer = buffer.slice(newlineIndex + 1);
				for (const chunk of drainLine(line)) yield chunk;
			}
		}
		buffer += decoder.decode();
		if (buffer.trim() !== "") {
			const line = buffer;
			buffer = "";
			for (const chunk of drainLine(line)) yield chunk;
		}
		if (!sawDone && !sawFinishReason) {
			if (open && open.text && open.text.trim()) {
				const closed = closeBlock();
				if (closed) yield closed;
				yield {
					type: "finish",
					reason: { kind: "stop" }
				};
				return;
			}
			throw new Error("agy stream terminated prematurely without [DONE] or finishReason");
		}
		const closed = closeBlock();
		if (closed) yield closed;
		if (lastUsage) yield {
			type: "usage",
			usage: lastUsage
		};
		else if (sawUsage) yield {
			type: "usage",
			usage: {
				inputTokens: 0,
				outputTokens: 0
			}
		};
		yield {
			type: "finish",
			reason: finishReason
		};
	} finally {
		reader.releaseLock();
	}
}
//#endregion
export { parse_exports as i, UnmappedFinishReasonError as n, parseAgySse as r, AgyStreamIdleTimeoutError as t };

//# sourceMappingURL=parse-BFsVTalF.mjs.map