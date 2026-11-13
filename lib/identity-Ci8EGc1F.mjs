import { randomBytes } from "node:crypto";
//#region src/runtime/identity.ts
/**
* Antigravity request/session identity generation (mirrors the active
* OmniRoute implementation; the archived reference stopped maintaining these).
*/
/** One request id per upstream call: `agent/<epoch>/<8 hex>`. */
function generateAntigravityRequestId() {
	return `agent/${Date.now()}/${randomBytes(4).toString("hex")}`;
}
const FNV_OFFSET_I64 = -3750763044362895579n;
const FNV_PRIME_I64 = 1099511628211n;
/** 64-bit FNV-1a hash of a string (stable across processes). */
function fnv1a64(input) {
	let hash = FNV_OFFSET_I64;
	for (let i = 0; i < input.length; i++) {
		hash ^= BigInt(input.charCodeAt(i));
		hash = BigInt.asIntN(64, hash * FNV_PRIME_I64);
	}
	return hash;
}
/** Fold a 64-bit hash into the positive 9e18 range the backend accepts. */
function foldToSessionRange(hash) {
	return `-${((hash < 0n ? -hash : hash) % 9000000000000000000n).toString()}`;
}
/**
* Derive the upstream `sessionId` for one (account, conversation, generation).
*
* The upstream accumulates a conversation's input SERVER-SIDE per `sessionId`.
* A long tool loop can push that accumulation past 1M tokens, after which EVERY
* request carrying the same `sessionId` fails with a 400 (`"The input token
* count exceeds the maximum number of tokens…"`) until the upstream session
* expires. Bumping the generation forces a fresh upstream session and recovers
* the conversation transparently.
*
* All three components are load-bearing:
*
* - **account** — two accounts must never share an upstream session.
* - **conversation** — every conversation on one account must have its own
*   session. A single per-account constant made every conversation look like one
*   upstream session, a structural anomaly no official client produces. The
*   caller passes `String(options.sessionId)`, which the DSH agent loop stamps
*   on every request it builds (`packages/core/agent-loop/src/agent.ts`,
*   `sessionId: this.session.id`), so this is authoritative rather than a
*   content hash. A fork replays its parent's history but carries a NEW session
*   id, which is exactly why hashing the first message would be wrong here.
* - **generation** — stable within one conversation (preserving the upstream
*   server-side session), distinct after a bump.
*
* Stability across a compaction holds for free: compaction is a request on the
* same session, so it derives the same id.
*
* Omitting `conversationKey` (the standalone CLI, which has no session store)
* degrades to the per-account id rather than inventing a conversation.
*/
function deriveAntigravitySessionId(accountKey, conversationKey, generation = 0) {
	if (!accountKey || accountKey.trim().length === 0) return null;
	const account = accountKey.trim();
	const conversation = conversationKey?.trim();
	if (!conversation && generation === 0) return foldToSessionRange(fnv1a64(account));
	return foldToSessionRange(fnv1a64(`${account}|${conversation ?? ""}|${generation}`));
}
/**
* Monotonic per-(account, conversation) generation counters, process-local.
*
* Deliberately in memory, not persisted: the counter exists to escape one
* upstream session that has hit the 1M wall, and that session is server-side
* state that expires. Surviving a local restart buys little — the upstream
* session it was escaping is usually gone too — while persisting it would force
* a storage-schema migration. The cost of the choice is one extra 400 if a
* process restarts mid-conversation while still over the limit.
*/
const sessionGenerations = /* @__PURE__ */ new Map();
function generationKey(accountKey, conversationKey) {
	return `${accountKey}\u0000${conversationKey}`;
}
/** Current generation for one (account, conversation); 0 when never bumped. */
function currentSessionGeneration(accountKey, conversationKey) {
	return sessionGenerations.get(generationKey(accountKey, conversationKey)) ?? 0;
}
/** Advance one (account, conversation) generation and return the new value. */
function bumpSessionGeneration(accountKey, conversationKey) {
	const key = generationKey(accountKey, conversationKey);
	const next = (sessionGenerations.get(key) ?? 0) + 1;
	sessionGenerations.delete(key);
	sessionGenerations.set(key, next);
	if (sessionGenerations.size > 500) {
		const oldest = sessionGenerations.keys().next();
		if (!oldest.done) sessionGenerations.delete(oldest.value);
	}
	return next;
}
//#endregion
export { generateAntigravityRequestId as i, currentSessionGeneration as n, deriveAntigravitySessionId as r, bumpSessionGeneration as t };

//# sourceMappingURL=identity-Ci8EGc1F.mjs.map