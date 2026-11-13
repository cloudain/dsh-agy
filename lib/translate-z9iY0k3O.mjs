import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { i as generateAntigravityRequestId } from "./identity-Ci8EGc1F.mjs";
import { a as isLevelThinkingModel, n as catalogModel, o as isUnifiedThinkingFamily, s as levelThinkingEffortsFor } from "./catalog-ukBj5TVm.mjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const DEFAULT_TTL_MS = 36e5;
const MAX_ENTRIES = 2e3;
const store = /* @__PURE__ */ new Map();
function pruneExpired(now = Date.now()) {
	if (store.size < MAX_ENTRIES / 2) return;
	for (const [key, entry] of store) if (entry.expiresAt <= now) store.delete(key);
}
/** Store the signature observed for one tool call id (response side). */
function setThoughtSignature(toolCallId, signature, ttlMs = DEFAULT_TTL_MS) {
	if (!toolCallId || !signature) return;
	pruneExpired();
	if (store.size >= MAX_ENTRIES) {
		let oldestKey = null;
		let oldestExpiry = Infinity;
		for (const [key, entry] of store) if (entry.expiresAt < oldestExpiry) {
			oldestExpiry = entry.expiresAt;
			oldestKey = key;
		}
		if (oldestKey) store.delete(oldestKey);
	}
	store.set(toolCallId, {
		signature,
		expiresAt: Date.now() + ttlMs
	});
}
/** Resolve the signature for one tool call id, or null when unknown/expired. */
function getThoughtSignature(toolCallId) {
	if (!toolCallId) return null;
	const entry = store.get(toolCallId);
	if (!entry) return null;
	if (entry.expiresAt <= Date.now()) {
		store.delete(toolCallId);
		return null;
	}
	return entry.signature;
}
//#endregion
//#region src/adapter/dsh-view.ts
function asString(value) {
	return typeof value === "string" ? value : void 0;
}
function asRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function normalizeBlocks(raw) {
	if (!Array.isArray(raw)) return [];
	const blocks = [];
	for (const entry of raw) {
		const block = asRecord(entry);
		if (!block) continue;
		switch (block.type) {
			case "text":
			case "reasoning": {
				const text = asString(block.text);
				if (text !== void 0) blocks.push({
					type: block.type,
					text
				});
				break;
			}
			case "image":
			case "file": {
				const attachment = asRecord(block.attachment);
				const attachmentId = attachment ? asString(attachment.attachmentId) : void 0;
				if (attachmentId !== void 0) blocks.push({
					type: block.type,
					attachment: { attachmentId }
				});
				break;
			}
			case "tool-call": {
				const id = asString(block.id);
				const name = asString(block.name);
				if (id !== void 0 && name !== void 0) blocks.push({
					type: "tool-call",
					id,
					name,
					arguments: block.arguments
				});
				break;
			}
			case "tool-result": {
				const toolCallId = asString(block.toolCallId);
				if (toolCallId !== void 0) blocks.push({
					type: "tool-result",
					toolCallId,
					content: normalizeBlocks(block.content),
					...block.isError === true ? { isError: true } : {}
				});
				break;
			}
		}
	}
	return blocks;
}
/**
* Project a raw harness message list into {@link AgyMessageView}s.
*
* Both vocabularies survive the projection as their own shapes — a 0.1.5
* `tool-result` block and a 0.2.0 `tool`-role message each keep the fields the
* translator needs — so the wire shape is decided in ONE place (`toolResultPart`
* in `translate.ts`) rather than duplicated per release line.
*
* @param raw - the harness's `GenerateOptions.messages` (or any list of them).
* @returns one normalized view per readable message, in order.
*/
function normalizeMessages(raw) {
	const messages = [];
	for (const entry of raw) {
		const message = asRecord(entry);
		if (!message) continue;
		const role = asString(message.role);
		if (role === void 0) continue;
		const id = asString(message.id);
		const toolCallId = asString(message.toolCallId);
		messages.push({
			role,
			...id === void 0 ? {} : { id },
			content: normalizeBlocks(message.content),
			...toolCallId === void 0 ? {} : { toolCallId },
			...message.isError === true ? { isError: true } : {}
		});
	}
	return messages;
}
/**
* Messages that project to a wire turn.
*
* `system` and `developer` are excluded because they are not conversation
* turns: the system prompt becomes `systemInstruction` and a developer message
* carries tool-addition/removal bookkeeping, which this channel expresses
* through the tool declarations themselves.
*/
function conversationMessages(messages) {
	return messages.filter((message) => message.role !== "system" && message.role !== "developer");
}
/**
* The system prompt text carried by `system`-role messages, in order.
*
* `GenerateOptions.system` is documented as the one-shot channel and is
* undefined for loop-built requests, whose derived history carries the prompt
* as a leading `system`-role message on BOTH supported lines. Reading only
* `options.system` therefore sent no system prompt at all for a real agent
* turn, and mapping the message through the conversation path sent it as a USER
* turn instead — this is the text that belongs in `systemInstruction`.
*/
function systemTextFromMessages(messages) {
	const parts = [];
	for (const message of messages) {
		if (message.role !== "system") continue;
		for (const block of message.content) if (block.type === "text" && block.text !== "") parts.push(block.text);
	}
	return parts.length > 0 ? parts.join("\n\n") : void 0;
}
//#endregion
//#region src/adapter/multimodal.ts
/**
* Multimodal file resolution for Google Gemini on Antigravity.
*
* In DeepSeek Harness (DSH), non-image files (PDF, audio, video, etc.)
* uploaded by users are converted by DSH's LLM runtime into deterministic
* text handles:
*
* `[File "${name}" (${bytes} bytes, sha256:${digest}): verbatim read-only copy saved at "${readonlyPath}". ...]`
*
* Gemini models natively support these files as base64-encoded `inlineData`
* parts alongside text. Claude models running behind the Antigravity Vertex
* proxy reject non-image `inlineData` with 500, so injection is scoped strictly
* to Gemini (non-Claude, vision-capable) models.
*/
/**
* MIME type mapping for Gemini supported multimodal formats.
*
* Covered formats (PDF observed live end-to-end; the rest follow Gemini's
* documented multimodal support and are not yet live-verified):
* - Document: .pdf -> 'application/pdf'
* - Audio: .mp3 -> 'audio/mp3', .wav -> 'audio/wav', .m4a -> 'audio/m4a', .aac -> 'audio/aac', .ogg -> 'audio/ogg', .flac -> 'audio/flac'
* - Video: .mp4 -> 'video/mp4', .mov -> 'video/quicktime', .webm -> 'video/webm'
* - Extended image: .bmp -> 'image/bmp', .heic -> 'image/heic', .heif -> 'image/heif'
*/
const GEMINI_MULTIMODAL_MIMES = Object.freeze({
	pdf: "application/pdf",
	mp3: "audio/mp3",
	wav: "audio/wav",
	m4a: "audio/m4a",
	aac: "audio/aac",
	ogg: "audio/ogg",
	flac: "audio/flac",
	mp4: "video/mp4",
	mov: "video/quicktime",
	webm: "video/webm",
	bmp: "image/bmp",
	heic: "image/heic",
	heif: "image/heif",
	".pdf": "application/pdf",
	".mp3": "audio/mp3",
	".wav": "audio/wav",
	".m4a": "audio/m4a",
	".aac": "audio/aac",
	".ogg": "audio/ogg",
	".flac": "audio/flac",
	".mp4": "video/mp4",
	".mov": "video/quicktime",
	".webm": "video/webm",
	".bmp": "image/bmp",
	".heic": "image/heic",
	".heif": "image/heif"
});
/**
* Regex matching DSH's deterministic read-only file handle blocks.
* Capture groups:
* 1: file name
* 2: file size in bytes
* 3: local read-only filesystem path
*/
const DSH_FILE_HANDLE_REGEX = /\[File "([^"]+)" \((\d+) bytes, sha256:[a-f0-9]+\): verbatim read-only copy saved at "([^"]+)"\./g;
/** Extract file handle descriptors from text content. */
function extractFileHandles(text) {
	const regex = new RegExp(DSH_FILE_HANDLE_REGEX.source, "g");
	const results = [];
	for (const match of text.matchAll(regex)) {
		const [, name, bytesStr, readonlyPath] = match;
		if (name && bytesStr && readonlyPath) {
			const bytes = parseInt(bytesStr, 10);
			if (!Number.isNaN(bytes)) results.push({
				name,
				bytes,
				readonlyPath
			});
		}
	}
	return results;
}
/** Resolve MIME type for a file name or path based on extension. */
function getMultimodalMimeType(filenameOrPath) {
	const dotIndex = filenameOrPath.lastIndexOf(".");
	if (dotIndex === -1) return void 0;
	const ext = filenameOrPath.slice(dotIndex + 1).toLowerCase();
	return GEMINI_MULTIMODAL_MIMES[ext];
}
/** Whether a model id belongs to a Claude-branded model (Vertex-hosted). */
function isClaudeModel(model) {
	return model.startsWith("claude-") || model.includes("/claude");
}
/**
* Check whether a model supports Gemini multimodal file inlineData.
* Deny-by-default: Claude models are always excluded (Vertex 500 on
* non-image inlineData), catalog models must be vision-capable, and ids
* unknown to the catalog are only allowed when they carry the `gemini-`
* prefix (so future tiered ids keep working without a catalog bump).
*/
function supportsMultimodalFiles(model) {
	if (isClaudeModel(model)) return false;
	const meta = catalogModel(model);
	if (meta) return meta.supportsVision === true;
	return model.startsWith("gemini-");
}
/**
* Resolve multimodal files referenced in user messages.
*
* Reads local files up to the effective cap (20MB by default) into base64
* strings. Silently ignores missing/unreadable files or files exceeding the size
* limit so the original text handle block remains intact in the prompt.
*/
async function resolveMultimodalFiles(optionsOrMessages, modelOrOptions, extraOptions) {
	let raw;
	let model;
	let customOptions;
	if ("messages" in optionsOrMessages) {
		raw = optionsOrMessages.messages ?? [];
		model = optionsOrMessages.model ?? "";
		customOptions = typeof modelOrOptions === "object" ? modelOrOptions : extraOptions;
	} else {
		raw = optionsOrMessages;
		if (typeof modelOrOptions === "string") {
			model = modelOrOptions;
			customOptions = extraOptions;
		} else {
			model = "";
			customOptions = modelOrOptions;
		}
	}
	const messages = normalizeMessages(raw);
	const result = /* @__PURE__ */ new Map();
	if (!supportsMultimodalFiles(model)) return result;
	const readFn = customOptions?.readFile ?? readFile;
	const cap = customOptions?.maxBytes ?? 20971520;
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (!message || message.role !== "user") continue;
		const resolvedForMessage = [];
		for (const block of message.content) {
			if (block.type !== "text" || typeof block.text !== "string") continue;
			const handles = extractFileHandles(block.text);
			for (const handle of handles) {
				if (handle.bytes > cap) continue;
				const mimeType = getMultimodalMimeType(handle.name) ?? getMultimodalMimeType(handle.readonlyPath);
				if (!mimeType) continue;
				try {
					const fileBuffer = await readFn(handle.readonlyPath);
					if (fileBuffer.length > cap) continue;
					resolvedForMessage.push({
						mimeType,
						data: Buffer.from(fileBuffer).toString("base64"),
						name: handle.name,
						path: handle.readonlyPath,
						bytes: fileBuffer.length
					});
				} catch {
					continue;
				}
			}
		}
		if (resolvedForMessage.length > 0) {
			const key = message.id ?? `msg-${i}`;
			result.set(key, resolvedForMessage);
		}
	}
	return result;
}
//#endregion
//#region src/adapter/translate.ts
/**
* Translate a DSH GenerateOptions into the Antigravity wrapped request.
*
* Envelope shape follows the actively-maintained OmniRoute wire format
* (the archived opencode reference predates it): top-level `project`,
* `requestId`, `model`, `userAgent`, `requestType`, with the Gemini-style
* body under `request` (contents/systemInstruction/tools/generationConfig/
* sessionId). `toolConfig` VALIDATED is attached when tools are present, and
* Claude-path requests strip trailing model turns (Vertex rejects "assistant
* message prefill").
*
* Thinking blocks are carried as-is on the Gemini path (Gemini `thought`
* parts); no thought is ever re-signed — that signature dance was an artifact
* of the reference plugin's interception architecture (see
* docs/ARCHITECTURE.md). The Claude path is stricter and drops thought parts
* entirely, because its validator demands a real thinking signature that only
* the originating model can produce (docs/ANTIGRAVITY-API.md §3.3).
*/
var translate_exports = /* @__PURE__ */ __exportAll({
	AGY_CLAUDE_MAX_OUTPUT_TOKENS: () => AGY_CLAUDE_MAX_OUTPUT_TOKENS,
	AGY_SCHEMA_ALLOWLIST: () => AGY_SCHEMA_ALLOWLIST,
	coalesceContents: () => coalesceContents,
	isClaudeModel: () => isClaudeModel,
	resolveWireModel: () => resolveWireModel,
	stripTrailingModelTurn: () => stripTrailingModelTurn,
	supportsMultimodalFiles: () => supportsMultimodalFiles,
	toAgyRequestBody: () => toAgyRequestBody
});
/**
* Vertex (the Antigravity Claude backend) rejects conversations ending on an
* assistant/model turn ("assistant message prefill"); never strip to empty.
*/
function stripTrailingModelTurn(contents) {
	while (contents.length > 1 && contents[contents.length - 1]?.role === "model") contents.pop();
	return contents;
}
/**
* The Antigravity backend parses tool `parameters` as a strict protobuf
* schema and rejects ANY unknown keyword with 400 (verified empirically:
* `$schema`, `propertyNames`, `pattern`, `minLength`, ... each fail in turn).
* Denylisting is whack-a-mole, so keep only the keywords the upstream
* accepts. Container shapes are handled distinctly: `properties` is a
* name->schema map (keys preserved), `items`/`additionalProperties` are
* nested schemas (additionalProperties also accepts a boolean — live-verified
* against the Antigravity upstream), `required`/`enum` are plain arrays.
*
* Keyword VALUES are also constrained by the protobuf shape (verified
* empirically): `type` must be a single enum string (union arrays like
* `["string","number"]` are rejected) and every `enum` item must be a
* non-empty string (booleans/numbers/empty strings are rejected). Values are
* normalized to the nearest valid form instead of being dropped wholesale.
*
* Schema SHAPE is constrained too: an `array` schema with no `items` is
* rejected outright — `GenerateContentRequest.tools[0].functionDeclarations
* [N].parameters.properties[steps].items: missing field` — because protobuf
* Schema has no "any item" form, so the field cannot be absent. JSON Schema
* itself allows it (DSH's enforced subset documents `items` as optional), and
* a hand-written tool parameter map drops it as easily as it writes it, so
* the sanitizer supplies `{"type":"string"}` for a missing `items` — the
* shape the register already declares by hand whenever an author spells it
* out (`{type:'array', items:{type:'string'}}`), and permissive in the same
* way a missing `items` is: the tool's own argument validation never depends
* on it. An `items` that EXISTS but carries no `type` is equally rejected, so
* a nested schema with neither `type` nor `properties` is typed `string` too.
*/
const AGY_SCHEMA_ALLOWLIST = /* @__PURE__ */ new Set([
	"type",
	"format",
	"title",
	"description",
	"nullable",
	"items",
	"enum",
	"default",
	"properties",
	"required",
	"additionalProperties"
]);
const AGY_SCHEMA_MAP_KEYS = /* @__PURE__ */ new Set(["properties"]);
const AGY_SCHEMA_NESTED_KEYS = /* @__PURE__ */ new Set(["items", "additionalProperties"]);
const AGY_SCHEMA_LIST_KEYS = /* @__PURE__ */ new Set(["required", "enum"]);
/** The item schema substituted for an `array` whose author declared no `items`. */
const AGY_MISSING_ITEMS_SCHEMA = { type: "string" };
/**
* Give an `array` schema an `items` the protobuf parser accepts, and give a
* nested schema that declares neither `type` nor `properties` one it accepts
* (see the shape paragraph on the contract above). Purely additive: a schema
* that already carries either stays byte-identical.
*
* The guard is a VALUE check, not a key-presence one: `items: undefined` keeps
* the key on the in-memory object and still serializes to nothing, so
* `'items' in node` would wave it through to the exact `missing field` 400 this
* function exists to prevent. `null` and a non-schema scalar take the same
* path. A JSON-Schema tuple (`items: [a, b]`) has no wire form at all —
* protobuf `Schema.items` is a single message, never repeated — so it degrades
* to its first element rather than going up as an array.
*/
function ensureItemSchema(node) {
	if (node.type !== "array") return;
	const items = node.items;
	if (Array.isArray(items)) {
		const first = items[0];
		node.items = first !== null && typeof first === "object" && !Array.isArray(first) ? first : { ...AGY_MISSING_ITEMS_SCHEMA };
		return;
	}
	if (items !== null && typeof items === "object") return;
	node.items = { ...AGY_MISSING_ITEMS_SCHEMA };
}
/**
* The `items` (or typed `additionalProperties`) slot must itself be typed;
* `{}`, `{description:'x'}` and a keywords-only union carrier all arrive here
* and are rejected as `missing field`. A `properties`-bearing schema is left
* alone — its `type` is inferred by the same rule that lets an untyped object
* schema through elsewhere. `additionalProperties: true|false` is a boolean
* and never reaches this function.
*/
function ensureNestedType(node) {
	if ("type" in node || "properties" in node) return;
	node.type = "string";
}
function sanitizeToolSchema(schema) {
	if (!schema || typeof schema !== "object") return schema;
	if (Array.isArray(schema)) return schema.map((entry) => sanitizeToolSchema(entry));
	let normalized = schema;
	if (Array.isArray(normalized.type)) {
		const types = normalized.type.filter((t) => typeof t === "string" && t !== "null");
		normalized = {
			...normalized,
			type: types[0] ?? "string"
		};
	}
	const result = {};
	for (const [key, value] of Object.entries(normalized)) {
		if (!AGY_SCHEMA_ALLOWLIST.has(key)) continue;
		if (AGY_SCHEMA_MAP_KEYS.has(key)) {
			const map = {};
			for (const [name, child] of Object.entries(value)) map[name] = sanitizeToolSchema(child);
			result[key] = map;
			continue;
		}
		if (AGY_SCHEMA_NESTED_KEYS.has(key)) {
			const nested = sanitizeToolSchema(value);
			if (nested && typeof nested === "object" && !Array.isArray(nested)) {
				const nestedRecord = nested;
				ensureNestedType(nestedRecord);
				if (key === "items") ensureItemSchema(nestedRecord);
			}
			result[key] = nested;
			continue;
		}
		if (AGY_SCHEMA_LIST_KEYS.has(key)) {
			if (key === "enum" && Array.isArray(value)) {
				const filtered = value.filter((v) => typeof v === "string" && v.length > 0);
				if (filtered.length > 0) result[key] = filtered;
			} else result[key] = value;
			continue;
		}
		result[key] = value;
	}
	ensureItemSchema(result);
	return result;
}
/**
* Collect tool-call names by id so tool results can name their function.
*
* Names are PUSHED rather than set, so a repeated id keeps every occurrence in
* document order; resolution consumes them FIFO (see {@link resolveToolName}).
*/
function buildToolNameIndex(messages) {
	const index = /* @__PURE__ */ new Map();
	for (const message of messages) for (const block of message.content) if (block.type === "tool-call") {
		const entry = index.get(block.id);
		if (entry) entry.names.push(block.name);
		else index.set(block.id, {
			names: [block.name],
			cursor: 0
		});
	}
	return index;
}
/**
* The name one `functionResponse` must carry, or undefined when the id answers
* no recorded call (the caller then falls back to the raw id, as it always did).
*
* FIFO per id: the calls recorded under an id are consumed in the order the
* results arrive in, so each result meets its OWN call even when the id
* repeats. Distinct ids never interact — the two cases a single-valued index
* conflated (a repeated id across distant turns, and two calls sharing one id
* inside one assistant turn) are handled by the same queue.
*
* Drained (more results than calls — a call dropped from the history while its
* result survived) is the one case with nothing left to pair: guessing the LAST
* name recorded for the id beats the pre-fix behaviour in both directions. The
* old lookup answered every extra result with that same last name, which was
* right whenever the repeated calls were the same tool and wrong the moment
* they were not; answering with the raw id instead would be wrong EVERY time,
* because an id is not a function name and upstream rejects it outright. So the
* last name is kept, and only a never-recorded id falls through to the raw id.
*/
function resolveToolName(toolNames, toolCallId) {
	const entry = toolNames.get(toolCallId);
	if (entry === void 0) return void 0;
	if (entry.cursor < entry.names.length) {
		const name = entry.names[entry.cursor];
		entry.cursor += 1;
		return name;
	}
	return entry.names[entry.names.length - 1];
}
/**
* The single producer of a `functionResponse` part.
*
* Both supported dsh-llm vocabularies funnel through here: a 0.1.5
* `tool-result` CONTENT BLOCK and a 0.2.0 `tool`-ROLE message describe the same
* result, and this channel's wire shape must not depend on which one arrived.
*/
function toolResultPart(toolCallId, isError, content, toolNames) {
	return { functionResponse: {
		id: toolCallId,
		name: resolveToolName(toolNames, toolCallId) ?? toolCallId,
		response: {
			result: content.filter((block) => block.type === "text").map((block) => block.text).join("\n"),
			is_error: isError
		}
	} };
}
function blockToParts(block, toolNames, images, dropThoughts = false) {
	switch (block.type) {
		case "text": return block.text === "" ? [] : [{ text: block.text }];
		case "reasoning":
			if (block.text === "") return [];
			if (dropThoughts) return [];
			return [{
				thought: true,
				text: block.text
			}];
		case "tool-call": {
			let args = {};
			if (typeof block.arguments === "object" && block.arguments !== null && !Array.isArray(block.arguments)) args = block.arguments;
			else if (typeof block.arguments === "string") try {
				const parsed = JSON.parse(block.arguments);
				if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) args = parsed;
			} catch {}
			return [{
				thoughtSignature: getThoughtSignature(block.id) ?? "skip_thought_signature_validator",
				functionCall: {
					id: block.id,
					name: block.name,
					args
				}
			}];
		}
		case "tool-result": return [toolResultPart(block.toolCallId, block.isError === true, block.content, toolNames)];
		case "image": {
			const resolved = images.get(block.attachment.attachmentId);
			if (!resolved) throw new Error(`agy translate: unresolved image attachment "${block.attachment.attachmentId}"`);
			return [{ inlineData: {
				mimeType: resolved.mediaType,
				data: resolved.data
			} }];
		}
		default: return [];
	}
}
function messageToContent(message, toolNames, images, multimodalFiles, messageIndex, dropThoughts = false) {
	if (message.role === "tool") {
		if (message.toolCallId === void 0) return null;
		return {
			role: "user",
			parts: [toolResultPart(message.toolCallId, message.isError === true, message.content, toolNames)]
		};
	}
	const parts = message.content.flatMap((block) => block.type === "image" && message.role !== "user" ? [] : blockToParts(block, toolNames, images, dropThoughts));
	if (message.role === "user" && multimodalFiles) {
		const files = (message.id ? multimodalFiles.get(message.id) : void 0) ?? multimodalFiles.get(message) ?? (messageIndex !== void 0 ? multimodalFiles.get(`msg-${messageIndex}`) : void 0) ?? (messageIndex !== void 0 ? multimodalFiles.get(String(messageIndex)) : void 0);
		if (files) for (const file of files) parts.push({ inlineData: {
			mimeType: file.mimeType,
			data: file.data
		} });
	}
	if (parts.length === 0) return null;
	return {
		role: message.role === "assistant" ? "model" : "user",
		parts
	};
}
/**
* Whether a part makes its turn a tool-result turn (`functionResponse` family).
* Every other part kind — text, media, thought, functionCall — belongs to the
* ordinary-content family.
*/
function isFrPart(part) {
	return "functionResponse" in part;
}
/**
* Merge adjacent same-role contents into single turns, functionResponse-family
* aware.
*
* The harness emits a fragmented per-step vocabulary — prompt, runtime-context
* snapshot, and injected `<system-reminder>` messages as separate `user`
* messages, one message per tool result — and its own first-party serializer
* coalesces adjacent same-role messages at the wire boundary. Forwarding the
* fragments 1:1 instead opened every request with a run of `user` turns that
* all belong to one logical prompt, and sent parallel tool results as separate
* one-`functionResponse` turns where the official Gemini tooling groups them
* into a single user turn.
*
* Family rule: a turn carrying `functionResponse` parts never merges with (or
* receives) other part kinds, so a mixed content is segmented in part order.
* The harness's serializer instead re-sorts tool results to the front of one
* merged message, but the Gemini-family validator is measured to reject a user
* content mixing `functionResponse` with text (400; langchainjs#11445, on the
* model family), and this channel's tolerance for the mixed shape is
* unmeasured. Separate adjacent turns keep every part while keeping each turn
* unmixed; parts are never reordered.
*
* Known boundary loss (pinned in tests): a model turn whose parts all drop
* (thoughts-only turn replayed on the Claude path) is filtered to null before
* this point, so the user turns around it fuse into one content. A text
* placeholder would fabricate a model utterance, and the acceptance of a
* structural empty turn (`parts: []`) is unmeasured here — so the fusion
* stands (issue #93).
*/
function coalesceContents(contents) {
	const result = [];
	let lastFamily;
	for (const content of contents) for (const part of content.parts) {
		const family = isFrPart(part);
		const last = result[result.length - 1];
		if (last && lastFamily === family && last.role === content.role) last.parts.push(part);
		else {
			result.push({
				role: content.role,
				parts: [part]
			});
			lastFamily = family;
		}
	}
	return result;
}
/**
* Builtin Gemini tools must not shadow functionDeclarations names (upstream
* treats them as native tools; verified by OmniRoute's GEMINI_BUILTIN_TOOL_NAMES).
*/
const AGY_BUILTIN_TOOL_NAMES = /* @__PURE__ */ new Set([
	"google_search",
	"web_search",
	"search_web",
	"googleSearch"
]);
/** Level-thinking: single id + selectable low/medium/high via thinkingLevel (catalog thinking:'level'). */
const LEVEL_THINKING_LEVELS = /* @__PURE__ */ new Set([
	"low",
	"medium",
	"high"
]);
/**
* Claude-family output ceiling on the Antigravity channel (live-measured).
*
* The Claude models are served through the Gemini-style
* `generationConfig.maxOutputTokens` field here, and this channel rejects the
* Claude family above 64000: 64000 answers 200, 64001 answers 400
* `INVALID_ARGUMENT: Request contains an invalid argument` (deterministic
* across both Claude ids, with and without the full 87-tool payload). The
* Gemini family accepts 65536 on the same endpoint, so the limit is
* model-family-specific, not endpoint-wide.
*
* Do NOT reason about this number from Anthropic's public API limits. Agy may
* front a self-hosted or otherwise gated Claude deployment whose capacity and
* validation rules are its own; the only authority is what this channel
* accepts, which is what the probe measures. The value here is that
* measurement, nothing more.
*
* The catalog's `maxOutputTokens` is the harness-injected default
* (`LlmResolvedModelInfo.defaultMaxTokens`), so a wrong value there makes every
* Claude request fail. This clamp is the second line of defense: it also covers
* an explicit `maxTokens` (agent preset / call config) and a dynamically
* discovered Claude id absent from the pinned catalog.
*/
const AGY_CLAUDE_MAX_OUTPUT_TOKENS = 64e3;
/** Upstream functionDeclarations names are `[a-zA-Z0-9_]` and ≤64 chars (OmniRoute-verified). */
const AGY_TOOL_NAME_MAX_LENGTH = 64;
/** Sanitize a tool name to the upstream charset/length; dedupe via a short hash. */
function sanitizeToolName(name, seen) {
	let candidate = name.replace(/[^a-zA-Z0-9_]/g, "_") || "tool";
	if (candidate.length > AGY_TOOL_NAME_MAX_LENGTH || seen.has(candidate)) {
		const hash = createHash("sha256").update(candidate).digest("hex").slice(0, 8);
		const prefix = candidate.slice(0, AGY_TOOL_NAME_MAX_LENGTH - hash.length - 1);
		candidate = `${prefix}_${hash}`;
		let i = 2;
		while (seen.has(candidate)) candidate = `${prefix}_${i++}_${hash}`;
	}
	seen.add(candidate);
	return candidate;
}
function toolsToDeclarations(tools) {
	if (!tools || tools.length === 0) return void 0;
	const seenNames = /* @__PURE__ */ new Set();
	const declarations = [];
	for (const tool of tools) {
		if (AGY_BUILTIN_TOOL_NAMES.has(tool.name)) continue;
		declarations.push({
			name: sanitizeToolName(tool.name, seenNames),
			description: tool.description,
			parameters: sanitizeToolSchema(tool.parameters)
		});
	}
	if (declarations.length === 0) return void 0;
	return [{ functionDeclarations: declarations }];
}
/**
* Resolve the concrete upstream model ID from the requested model and effort.
* Discrete-variant models (Gemini 4 Argon, Claude 5.5 series) are unified in DSH
* with level thinking, and mapped to the matching discrete wire model on request.
*/
function resolveWireModel(model, effort) {
	if (isUnifiedThinkingFamily(model)) return `${model}-${effort === "low" ? "low" : effort === "high" ? "high" : "medium"}`;
	return model;
}
/** Build the wrapped Antigravity request body for one call. */
function toAgyRequestBody(options, context) {
	const messages = normalizeMessages(options.messages);
	const toolNames = buildToolNameIndex(messages);
	const images = context.images ?? /* @__PURE__ */ new Map();
	const multimodalFiles = supportsMultimodalFiles(options.model) ? context.multimodalFiles : void 0;
	const claude = isClaudeModel(options.model);
	let contents = coalesceContents(conversationMessages(messages).map((message, index) => messageToContent(message, toolNames, images, multimodalFiles, index, claude)).filter((c) => c !== null));
	if (claude) contents = stripTrailingModelTurn(contents);
	const systemText = [options.system, systemTextFromMessages(messages)].filter((text) => typeof text === "string" && text !== "").join("\n\n");
	const tools = toolsToDeclarations(options.tools);
	const generationConfig = {};
	if (options.temperature !== void 0) generationConfig.temperature = options.temperature;
	if (options.maxTokens !== void 0) generationConfig.maxOutputTokens = isClaudeModel(options.model) ? Math.min(options.maxTokens, AGY_CLAUDE_MAX_OUTPUT_TOKENS) : options.maxTokens;
	if (options.stop !== void 0 && options.stop.length > 0) generationConfig.stopSequences = options.stop;
	const effort = options.reasoningEffort?.toLowerCase();
	if (isLevelThinkingModel(options.model)) {
		if (options.purpose === "session-title" || effort === "none" || effort === "off") generationConfig.thinkingConfig = { thinkingBudget: 0 };
		else if (effort === void 0) {
			const tiered = context.tieredBudgetFor?.();
			if (tiered !== void 0) generationConfig.thinkingConfig = {
				thinkingBudget: tiered,
				includeThoughts: true
			};
		} else if (LEVEL_THINKING_LEVELS.has(effort) && levelThinkingEffortsFor(options.model).includes(effort)) {
			const configured = context.thinkingBudgetFor?.(effort);
			if (options.model === "gemini-4-argon" || options.model === "claude-opus-5-5" || options.model === "claude-sonnet-5-5") {
				if (configured !== void 0) generationConfig.thinkingConfig = {
					thinkingBudget: configured,
					includeThoughts: true
				};
			} else generationConfig.thinkingConfig = configured === void 0 ? {
				thinkingLevel: effort,
				includeThoughts: true
			} : {
				thinkingBudget: configured,
				includeThoughts: true
			};
		}
	} else if (claude && options.purpose !== "session-title") {
		const claudeBudget = context.claudeBudgetFor?.();
		const outputCap = generationConfig.maxOutputTokens;
		if (claudeBudget !== void 0 && outputCap !== void 0 && outputCap > claudeBudget) generationConfig.thinkingConfig = {
			thinkingBudget: claudeBudget,
			includeThoughts: true
		};
	}
	return {
		project: context.projectId || void 0,
		requestId: context.requestId ?? generateAntigravityRequestId(),
		model: resolveWireModel(options.model, effort),
		userAgent: "antigravity",
		requestType: "agent",
		request: {
			contents,
			...systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {},
			...tools ? { tools } : {},
			...tools ? { toolConfig: { functionCallingConfig: { mode: "VALIDATED" } } } : {},
			...Object.keys(generationConfig).length > 0 ? { generationConfig } : {},
			...context.sessionId ? { sessionId: context.sessionId } : {}
		}
	};
}
//#endregion
export { setThoughtSignature as i, translate_exports as n, resolveMultimodalFiles as r, toAgyRequestBody as t };

//# sourceMappingURL=translate-z9iY0k3O.mjs.map