//#region src/adapter/catalog.ts
const AGY_PUBLIC_MODELS = [
	{
		id: "gemini-4-argon",
		name: "Gemini 4 Argon",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true,
		thinking: "level"
	},
	{
		id: "claude-opus-5-5",
		name: "Claude Opus 5.5",
		contextLength: 2e5,
		maxOutputTokens: 64e3,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true,
		thinking: "level"
	},
	{
		id: "claude-sonnet-5-5",
		name: "Claude Sonnet 5.5",
		contextLength: 2e5,
		maxOutputTokens: 64e3,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true,
		thinking: "level"
	},
	{
		id: "gemini-3.8-flash-tiered",
		name: "Gemini 3.8 Flash",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true,
		thinking: "level",
		thinkingLevels: [
			"low",
			"medium",
			"high"
		]
	},
	{
		id: "gemini-3.7-flash-tiered",
		name: "Gemini 3.7 Flash",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true,
		thinking: "level",
		thinkingLevels: [
			"low",
			"medium",
			"high"
		]
	},
	{
		id: "gemini-3.6-flash-tiered",
		name: "Gemini 3.6 Flash (Tiered)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true,
		thinking: "level",
		thinkingLevels: [
			"low",
			"medium",
			"high"
		]
	},
	{
		id: "gemini-3.6-flash-high",
		name: "Gemini 3.6 Flash (High)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3.6-flash-medium",
		name: "Gemini 3.6 Flash (Medium)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3.6-flash-low",
		name: "Gemini 3.6 Flash (Low)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "claude-opus-4-6-thinking",
		name: "Claude Opus 4.6 (Thinking)",
		contextLength: 1048576,
		maxOutputTokens: 64e3,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "claude-sonnet-4-6",
		name: "Claude Sonnet 4.6 (Thinking)",
		contextLength: 1048576,
		maxOutputTokens: 64e3,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-pro-agent",
		name: "Gemini 3.1 Pro (High)",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3.1-pro-low",
		name: "Gemini 3.1 Pro (Low)",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true,
		thinking: "level",
		thinkingLevels: ["low", "high"]
	},
	{
		id: "gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3-flash-agent",
		name: "Gemini 3.5 Flash (High)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3.5-flash-low",
		name: "Gemini 3.5 Flash (Medium)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3.5-flash-extra-low",
		name: "Gemini 3.5 Flash (Low)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3.5-flash-lite",
		name: "Gemini 3.5 Flash Lite",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3-flash",
		name: "Gemini 3 Flash",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-3.1-flash-lite",
		name: "Gemini 3.1 Flash Lite",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-2.5-flash-thinking",
		name: "Gemini 2.5 Flash Thinking",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-2.5-flash-lite",
		name: "Gemini 2.5 Flash Lite",
		contextLength: 1048576,
		maxOutputTokens: 65535,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-4-argon-high",
		name: "Gemini 4 Argon (High)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-4-argon-medium",
		name: "Gemini 4 Argon (Medium)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gemini-4-argon-low",
		name: "Gemini 4 Argon (Low)",
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true
	},
	{
		id: "gpt-oss-120b-medium",
		name: "GPT-OSS 120B (Medium)",
		contextLength: 131072,
		maxOutputTokens: 32768,
		supportsReasoning: true,
		toolCalling: true
	}
];
const CATALOG_BY_ID = new Map(AGY_PUBLIC_MODELS.map((m) => [m.id, m]));
/** Format dynamic tiered model id to display name (e.g. 'gemini-3.8-flash-tiered' -> 'Gemini 3.8 Flash'). */
function formatTieredModelName(modelId) {
	return modelId.replace(/-tiered$/, "").split("-").map((part) => {
		if (/^\d+(\.\d+)*$/.test(part)) return part;
		return part.charAt(0).toUpperCase() + part.slice(1);
	}).join(" ");
}
/**
* Ids the picker must not offer: tab-completion helpers and the per-tab session
* ids that ride the same role lists.
*
* Both shapes are discoverable — they appear in \`models\` — but neither is an
* agent chat model. The \`tab_\` prefix is the older shape; \`chat_<digits>\` is
* the live one (\`chat_20706\`), and upstream names those under \`tabModelIds\`
* rather than by prefix, so an account whose discovery omits the role list would
* otherwise render a raw id with no metadata. Deciding it from the id here keeps
* the catalog-only fallback and the role-based hiding in agreement.
*/
function isChatCallableModelId(modelId) {
	return !modelId.startsWith("tab_") && !/^chat_\d+$/.test(modelId) && !modelId.endsWith("-disabled");
}
function catalogModel(modelId) {
	const existing = CATALOG_BY_ID.get(modelId);
	if (existing) return existing;
	if (typeof modelId === "string" && modelId.endsWith("-tiered")) return {
		id: modelId,
		name: formatTieredModelName(modelId),
		contextLength: 1048576,
		maxOutputTokens: 65536,
		supportsReasoning: true,
		supportsVision: true,
		toolCalling: true,
		thinking: "level"
	};
}
/** Dynamically discovered tiered models and their family ('flash', 'pro', 'flashLite', etc.). */
const DISCOVERED_TIERED_FAMILIES = /* @__PURE__ */ new Map();
/**
* Priority ranking for tiered model families.
*
* Specific feature families (flash, flashLite) take precedence over the generic 'pro'
* grouping when upstream redundantly lists a model under multiple categories
* (e.g. Google's fetchAvailableModels returns gemini-3.8-flash-tiered in both flash and pro).
*/
const TIERED_FAMILY_PRECEDENCE = Object.freeze({
	flash: 10,
	flashlite: 10,
	pro: 1
});
/**
* Register tiered models advertised by `fetchAvailableModels`'s `tieredModelIds`.
*
* Upstream groups tiered models by family (e.g. `{ flash: [...], pro: ['gemini-3.1-pro-low'], flashLite: [...] }`).
* Specificity precedence ensures high-capability families are preserved when upstream has group overlap.
*/
function registerDiscoveredTieredModels(tiered) {
	if (!tiered || typeof tiered !== "object" || Array.isArray(tiered)) return;
	for (const [family, ids] of Object.entries(tiered)) {
		if (!Array.isArray(ids)) continue;
		const lowerFamily = family.toLowerCase();
		const newPrecedence = TIERED_FAMILY_PRECEDENCE[lowerFamily] ?? 5;
		for (const id of ids) if (typeof id === "string" && id.length > 0) {
			const existingFamily = DISCOVERED_TIERED_FAMILIES.get(id);
			if (newPrecedence >= (existingFamily ? TIERED_FAMILY_PRECEDENCE[existingFamily] ?? 5 : 0)) DISCOVERED_TIERED_FAMILIES.set(id, lowerFamily);
		}
	}
}
const DISCOVERED_UNIFIED_THINKING_FAMILIES = /* @__PURE__ */ new Set();
/** Register dynamically discovered unified thinking families (e.g. models with discrete -low/-medium/-high variants). */
function registerDiscoveredUnifiedThinkingFamily(baseId) {
	DISCOVERED_UNIFIED_THINKING_FAMILIES.add(baseId);
}
/** Check whether a model ID is a unified thinking family (known static or dynamically discovered). */
function isUnifiedThinkingFamily(modelId) {
	return modelId === "gemini-4-argon" || modelId === "claude-opus-5-5" || modelId === "claude-sonnet-5-5" || DISCOVERED_UNIFIED_THINKING_FAMILIES.has(modelId);
}
/**
* Level-thinking models: a single id with selectable tiers via `thinkingLevel`.
*
* Consults dynamically discovered `tieredModelIds` first, falling back to the catalog's
* explicit `thinking: 'level'` metadata, unified thinking families, and legacy `-tiered` suffix.
*/
function isLevelThinkingModel(modelId) {
	if (catalogModel(modelId)?.thinking === "level") return true;
	if (DISCOVERED_TIERED_FAMILIES.has(modelId)) return true;
	if (typeof modelId === "string") {
		if (modelId.endsWith("-tiered")) return true;
		if (isUnifiedThinkingFamily(modelId)) return true;
	}
	return false;
}
/**
* The reasoning levels supported by a level-thinking model.
*
* Flash family exposes low/medium/high; Pro family exposes low/high only
* (measured: Pro models reject medium thinking levels).
*/
function levelThinkingEffortsFor(modelId) {
	const cat = catalogModel(modelId);
	if (cat?.thinkingLevels) return cat.thinkingLevels;
	if (DISCOVERED_TIERED_FAMILIES.get(modelId) === "pro") return ["low", "high"];
	return [
		"low",
		"medium",
		"high"
	];
}
//#endregion
export { isLevelThinkingModel as a, registerDiscoveredTieredModels as c, isChatCallableModelId as i, registerDiscoveredUnifiedThinkingFamily as l, catalogModel as n, isUnifiedThinkingFamily as o, formatTieredModelName as r, levelThinkingEffortsFor as s, AGY_PUBLIC_MODELS as t };

//# sourceMappingURL=catalog-ukBj5TVm.mjs.map