import { m as currentAgyVersion } from "../constants-BboCQZJG.mjs";
import { i as normalizeProxyUrl, n as isProxyReachable, s as proxyUrlForLogs } from "../proxy-B7VnbAfO.mjs";
import { a as generateFingerprint, d as agyDataFile, i as isAgyDisabled, l as clearExpiredState, n as maskProxyUrl, o as recordFingerprintVersion } from "../accounts-B2cbfi3y.mjs";
import "../models-ev8NAQa3.mjs";
import { a as CLAUDE_BUDGET_MIN, i as CLAUDE_BUDGET_MAX, n as dayKey, o as THINKING_BUDGET_MAX, r as foldWindowBreakdown, t as createAgyRuntime } from "../plugin-common-DLpF5A04.mjs";
import { t as exchangeAntigravity } from "../exchange-mjEsIwkU.mjs";
import { n as upsertImportedAccount, r as authorizeAntigravity, t as importManySources } from "../import-B2wF11kK.mjs";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const UI_PREFS_FILE = "agy-ui-prefs.json";
function sanitizeUiPrefs(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { version: 1 };
	const obj = raw;
	const doc = { version: 1 };
	if (typeof obj.conversationBadge === "boolean") doc.conversationBadge = obj.conversationBadge;
	if (typeof obj.detailedQuotaReset === "boolean") doc.detailedQuotaReset = obj.detailedQuotaReset;
	return doc;
}
function parseUiPrefs(text) {
	let raw;
	try {
		raw = JSON.parse(text);
	} catch {
		return { version: 1 };
	}
	return sanitizeUiPrefs(raw);
}
var UiPrefsStore = class UiPrefsStore {
	file;
	doc;
	raw;
	constructor(file = agyDataFile(UI_PREFS_FILE)) {
		this.file = file;
		const { doc, raw } = this.readWithRaw();
		this.doc = doc;
		this.raw = raw;
	}
	get() {
		this.reloadIfChanged();
		return {
			conversationBadge: this.doc.conversationBadge === true,
			detailedQuotaReset: this.doc.detailedQuotaReset === true
		};
	}
	set(prefs) {
		this.reload();
		const next = {
			version: 1,
			...this.doc.conversationBadge !== void 0 ? { conversationBadge: this.doc.conversationBadge } : {},
			...this.doc.detailedQuotaReset !== void 0 ? { detailedQuotaReset: this.doc.detailedQuotaReset } : {}
		};
		if (typeof prefs.conversationBadge === "boolean") next.conversationBadge = prefs.conversationBadge;
		if (typeof prefs.detailedQuotaReset === "boolean") next.detailedQuotaReset = prefs.detailedQuotaReset;
		this.write(next);
		this.doc = next;
		this.raw = UiPrefsStore.serialize(next);
		return {
			conversationBadge: next.conversationBadge === true,
			detailedQuotaReset: next.detailedQuotaReset === true
		};
	}
	reload() {
		const fresh = this.readWithRaw();
		this.doc = fresh.doc;
		this.raw = fresh.raw;
	}
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
	readWithRaw() {
		let text;
		try {
			text = readFileSync(this.file, "utf8");
		} catch {
			return {
				doc: { version: 1 },
				raw: ""
			};
		}
		return {
			doc: parseUiPrefs(text),
			raw: text
		};
	}
	write(doc) {
		const serialized = UiPrefsStore.serialize(doc);
		const tmp = `${this.file}.tmp.${process.pid}.${Date.now()}`;
		mkdirSync(dirname(this.file), { recursive: true });
		writeFileSync(tmp, serialized, { mode: 384 });
		renameSync(tmp, this.file);
	}
	static serialize(doc) {
		return `${JSON.stringify(doc, null, 2)}\n`;
	}
};
//#endregion
//#region src/web/management.ts
/**
* agy management API: one method dispatcher shared by the RPC transport.
*
* Every method is a pure `(payload) => result` function so the transport stays
* thin and the handlers stay testable without HTTP. Failures throw; the
* transport converts a thrown error into the RPC failure envelope.
*
* This module owns the OAuth pending-authorization state because `auth.url`
* issues it and the callback route consumes it — they must share one map, and
* splitting them would let a verifier and its callback drift apart.
*/
/** Fail one RPC with a message the UI can show verbatim. */
function fail(message) {
	throw new Error(message);
}
function asIndex(payload) {
	const index = Number(payload?.index);
	if (!Number.isInteger(index) || index < 0) fail("invalid index");
	return index;
}
/**
* Flatten one account's ledger entry for transport.
*
* `models` is deliberately NOT carried: the per-model table that read it was
* removed (the cumulative metric strip states the same figures better), and
* sending fields no client reads is a wire surface with no consumer, which
* reads as intentional to the next person and invites a stale assumption.
* `lastUsedAt` DOES travel — the account row's activity fragment reads it.
*/
function toAccountUsageView(usage) {
	if (usage === void 0) return null;
	return {
		totals: usage.totals,
		sources: usage.sources,
		lastUsedAt: typeof usage.lastUsedAt === "number" && Number.isFinite(usage.lastUsedAt) ? usage.lastUsedAt : null
	};
}
function createAgyManagement(options) {
	const { store, sessions, stats, recentRequests, modelVisibility, listAllModels, invalidateModelCache, baseUrl, notifyModelsChanged } = options;
	const thinkingBudget = options.thinkingBudget;
	const multimodal = options.multimodal;
	const uiPrefs = options.uiPrefs ?? new UiPrefsStore();
	/** Authorizations issued by `auth.url`, keyed by raw state. */
	const pendingAuth = /* @__PURE__ */ new Map();
	const PENDING_AUTH_TTL_MS = 6e5;
	const prunePendingAuth = (now = Date.now()) => {
		for (const [key, entry] of pendingAuth) if (entry.expiresAt <= now) pendingAuth.delete(key);
		while (pendingAuth.size > 100) {
			let oldestKey = null;
			let oldestExpiry = Infinity;
			for (const [key, entry] of pendingAuth) if (entry.expiresAt < oldestExpiry) {
				oldestExpiry = entry.expiresAt;
				oldestKey = key;
			}
			if (oldestKey === null) break;
			pendingAuth.delete(oldestKey);
		}
	};
	const listAccounts = async () => {
		const storage = await store.load();
		const now = Date.now();
		for (const account of storage.accounts) clearExpiredState(account, now);
		const ledger = stats.snapshot();
		const rows = [];
		for (const [index, account] of storage.accounts.entries()) {
			const state = account.enabled === false ? "disabled" : account.verificationRequired === true ? "verification-required" : account.coolingDownUntil !== void 0 && account.coolingDownUntil > now ? "cooling" : "active";
			const key = account.email ?? account.id;
			rows.push({
				index,
				email: account.email ?? null,
				projectId: account.projectId ?? null,
				active: index === storage.activeIndex && account.enabled !== false,
				state,
				disabledAt: account.enabled === false && account.verificationRequiredAt !== void 0 ? new Date(account.verificationRequiredAt).toISOString() : null,
				cooldownUntil: account.coolingDownUntil !== void 0 && account.coolingDownUntil > now ? new Date(account.coolingDownUntil).toISOString() : null,
				cooldownReason: account.cooldownReason ?? null,
				cooldownSetAt: account.cooldownSetAt === void 0 ? null : new Date(account.cooldownSetAt).toISOString(),
				/**
				* Appeal link from an upstream verification challenge. Surfaced, never
				* followed automatically: only the account owner can complete it, and the
				* account returns to service on its own once the wall clears.
				*/
				verificationUrl: account.verificationUrl ?? null,
				verificationRequired: account.verificationRequired === true && account.enabled !== false,
				rateLimits: account.rateLimitResetTimes ?? null,
				fingerprint: account.fingerprint ? {
					userAgent: account.fingerprint.userAgent,
					deviceId: account.fingerprint.deviceId,
					createdAt: account.fingerprint.createdAt
				} : null,
				fingerprintHistory: (account.fingerprintHistory ?? []).length,
				proxy: account.proxy ? maskProxyUrl(account.proxy) : null,
				limits: account.cachedLimits?.groups ?? null,
				limitsUpdatedAt: account.cachedLimits?.updatedAt ?? null,
				limitBurn: null,
				usage: key === void 0 ? null : toAccountUsageView(ledger.accounts[key])
			});
		}
		return rows;
	};
	/** Fold the ledger into the Usage tab's view. */
	const statsView = () => {
		const doc = stats.snapshot();
		const now = Date.now();
		const byModel = /* @__PURE__ */ new Map();
		for (const usage of Object.values(doc.accounts)) for (const [model, counters] of Object.entries(usage.models)) {
			const current = byModel.get(model);
			if (current === void 0) byModel.set(model, { ...counters });
			else for (const key of Object.keys(current)) current[key] += counters[key];
		}
		const allModels = [...byModel.entries()].map(([model, counters]) => ({
			model,
			counters
		})).sort((a, b) => b.counters.requests - a.counters.requests);
		const allAccounts = Object.entries(doc.accounts).map(([account, usage]) => ({
			account,
			counters: usage.totals
		})).sort((a, b) => b.counters.requests - a.counters.requests);
		const breakdown = (days) => {
			const { totals, models, accounts } = foldWindowBreakdown(doc, days, now);
			return {
				counters: totals,
				models,
				accounts
			};
		};
		const daySeries = Array.from({ length: 7 }, (_, i) => {
			const key = dayKey(now - (6 - i) * 864e5);
			const bucket = doc.days[key];
			return {
				day: key,
				requests: bucket?.totals.requests ?? 0,
				failed: bucket?.totals.failed ?? 0,
				rateLimited: bucket?.totals.rateLimited ?? 0,
				rotations: bucket?.totals.rotations ?? 0
			};
		});
		return {
			since: doc.totals.requests > 0 ? doc.since : null,
			all: {
				counters: doc.totals,
				models: allModels,
				accounts: allAccounts
			},
			today: breakdown(1),
			week: breakdown(7),
			month: breakdown(30),
			days: daySeries
		};
	};
	const methods = {
		"account.list": async () => ({ accounts: await listAccounts() }),
		"pool.status": async () => ({ busy: await sessions.inFlightAccounts() }),
		"pool.recent": async () => ({ recent: recentRequests() }),
		"account.activate": async (payload) => {
			const index = asIndex(payload);
			await sessions.activateAccount(index);
			invalidateModelCache();
			return {
				ok: true,
				index
			};
		},
		"account.delete": async (payload) => {
			const index = asIndex(payload);
			await store.mutate((storage) => {
				if (index >= storage.accounts.length) fail("account not found");
				storage.accounts.splice(index, 1);
				if (storage.activeIndex >= storage.accounts.length) storage.activeIndex = 0;
			});
			return { ok: true };
		},
		"account.verify": async (payload) => sessions.verifyAccount(asIndex(payload)),
		"account.health": async (payload) => {
			const raw = payload?.indices;
			const indices = Array.isArray(raw) ? raw.map((value) => Number(value)) : void 0;
			return { results: await sessions.checkAccounts(indices) };
		},
		/**
		* Refresh and return the 5h/weekly windows for every enabled account.
		*
		* A SEPARATE call rather than a field on `account.list`, because that reply
		* is deliberately probe-free (see the note above its return): folding an
		* upstream call into it made the whole accounts+usage view wait on the
		* network and show "no accounts" behind a spinner. Here the client renders
		* the list from `account.list` immediately and merges these in when they
		* arrive, so a slow probe costs a placeholder, not the page.
		*
		* Server-side this is TTL-gated, so the upstream call happens at most once
		* per window rather than once per view. `force` bypasses that gate for an
		* EXPLICIT refresh — without it the toolbar's Refresh button could not
		* deliver "the latest numbers now", which is the only reason to click it
		* while the snapshot is still inside its TTL.
		*/
		"account.limits": async (payload) => {
			const force = payload?.force === true;
			const storage = await store.load();
			const result = await sessions.refreshLimits(storage, { force }).catch(() => ({
				measured: [],
				failed: [],
				skipped: 0
			}));
			const fresh = await store.load();
			const burn = await sessions.limitBurnRates().catch(() => []);
			const burnByIndex = new Map(burn.map((entry) => [entry.index, entry.perHour]));
			return {
				limits: fresh.accounts.map((account, index) => ({
					index,
					groups: account.cachedLimits?.groups ?? null,
					updatedAt: account.cachedLimits?.updatedAt ?? null,
					burn: burnByIndex.get(index) ?? null
				})),
				measured: result.measured.length,
				failed: result.failed.length,
				skipped: result.skipped
			};
		},
		"account.test": async (payload) => {
			const model = payload?.model;
			if (typeof model !== "string" || model === "") fail("model is required");
			const rawIndex = payload?.index;
			return sessions.testCall(model, { ...rawIndex === void 0 ? {} : { accountIndex: asIndex(payload) } });
		},
		"account.export": async (payload) => sessions.exportBlob(asIndex(payload)),
		"account.exportAll": async () => {
			const storage = await store.load();
			const blobs = [];
			for (let index = 0; index < storage.accounts.length; index++) {
				const result = await sessions.exportBlob(index);
				if (result.blob !== void 0) blobs.push({
					index,
					blob: result.blob
				});
			}
			return { blobs };
		},
		"account.import": async (payload) => {
			const body = payload;
			const kind = body?.kind === "blob" ? "blob" : "json";
			const sources = Array.isArray(body?.sources) ? body.sources : [];
			if (sources.length === 0) fail("nothing to import");
			const result = await importManySources(sources.map((source) => ({
				source,
				kind
			})), store, { overwriteExisting: true });
			return {
				imported: result.imported,
				replaced: result.replaced,
				errors: result.errors.map((error) => String(error))
			};
		},
		"account.fingerprint": async (payload) => {
			const index = asIndex(payload);
			const action = payload?.action === "regenerate" ? "regenerate" : "show";
			return store.mutate(async (storage) => {
				const account = storage.accounts[index];
				if (!account) fail("account not found");
				if (action === "regenerate") {
					const fresh = generateFingerprint(void 0, currentAgyVersion());
					account.fingerprint = fresh;
					account.fingerprintHistory = recordFingerprintVersion(account.fingerprintHistory, fresh, "regenerated");
				}
				return {
					action,
					fingerprint: account.fingerprint ? {
						userAgent: account.fingerprint.userAgent,
						deviceId: account.fingerprint.deviceId,
						createdAt: account.fingerprint.createdAt
					} : null,
					history: account.fingerprintHistory?.length ?? 0
				};
			});
		},
		"account.proxy": async (payload) => {
			const index = asIndex(payload);
			const raw = payload?.proxy;
			const proxy = typeof raw === "string" ? raw : "";
			if (proxy.trim() === "") {
				await store.mutate((storage) => {
					const account = storage.accounts[index];
					if (!account) fail("account not found");
					delete account.proxy;
				});
				return {
					ok: true,
					proxy: null,
					proxyMasked: null,
					rawLogs: null
				};
			}
			let normalized;
			try {
				normalized = normalizeProxyUrl(proxy);
			} catch (error) {
				fail(error instanceof Error ? error.message : String(error));
			}
			await store.mutate((storage) => {
				const account = storage.accounts[index];
				if (!account) fail("account not found");
				account.proxy = normalized;
			});
			return {
				ok: true,
				proxy: maskProxyUrl(normalized),
				proxyMasked: maskProxyUrl(normalized),
				rawLogs: proxyUrlForLogs(normalized)
			};
		},
		"account.proxyTest": async (payload) => {
			const body = payload;
			const hasExplicit = typeof body?.proxy === "string" && body.proxy.trim() !== "";
			let target;
			if (hasExplicit) try {
				target = normalizeProxyUrl(body.proxy);
			} catch (error) {
				fail(error instanceof Error ? error.message : String(error));
			}
			else {
				const index = asIndex(payload);
				const account = (await store.load()).accounts[index];
				if (!account) fail("account not found");
				if (!account.proxy) fail("no proxy configured for this account");
				target = account.proxy;
			}
			const masked = maskProxyUrl(target) ?? proxyUrlForLogs(target);
			try {
				const ok = await isProxyReachable(target, 2e3);
				return ok ? {
					ok,
					masked
				} : {
					ok,
					masked,
					error: `proxy unreachable: ${masked}`
				};
			} catch (error) {
				return {
					ok: false,
					masked,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		},
		"auth.url": async () => {
			const authorization = await authorizeAntigravity(`${baseUrl()}/agy/oauth-callback`);
			prunePendingAuth();
			pendingAuth.set(authorization.state, {
				verifier: authorization.verifier,
				expiresAt: Date.now() + PENDING_AUTH_TTL_MS
			});
			return { url: authorization.url };
		},
		"model.list": async () => {
			const session = await sessions.getSession().catch(() => void 0);
			if (session === void 0) fail("No agy account configured — run `dsh-agy login` first.");
			const models = await listAllModels();
			const hidden = modelVisibility.disabledFor("agy");
			const rows = models.map((model) => ({
				id: model.id,
				name: model.name,
				disabled: hidden.has(model.id)
			}));
			return {
				account: session.account.email ?? null,
				models: rows
			};
		},
		"model.setDisabled": async (payload) => {
			const body = payload;
			const modelId = body?.modelId;
			if (typeof modelId !== "string" || modelId === "") fail("modelId is required");
			const disabled = body?.disabled === true;
			modelVisibility.setDisabled("agy", modelId, disabled);
			notifyModelsChanged();
			return {
				modelId,
				disabled
			};
		},
		"thinking.get": async () => ({
			budgets: thinkingBudget.all(),
			min: -1,
			max: THINKING_BUDGET_MAX,
			tieredBudget: thinkingBudget.tiered() ?? null,
			claudeBudget: thinkingBudget.claude() ?? null,
			claudeMin: CLAUDE_BUDGET_MIN,
			claudeMax: CLAUDE_BUDGET_MAX
		}),
		"thinking.setTiered": async (payload) => {
			const raw = payload?.budget;
			if (raw !== void 0 && raw !== null && typeof raw !== "number") fail("budget must be a number");
			try {
				return { tieredBudget: thinkingBudget.setTiered(raw === void 0 || raw === null ? void 0 : raw) ?? null };
			} catch (error) {
				fail(error instanceof Error ? error.message : String(error));
			}
		},
		"thinking.setClaude": async (payload) => {
			const raw = payload?.budget;
			if (raw !== void 0 && raw !== null && typeof raw !== "number") fail("budget must be a number");
			try {
				return { claudeBudget: thinkingBudget.setClaude(raw === void 0 || raw === null ? void 0 : raw) ?? null };
			} catch (error) {
				fail(error instanceof Error ? error.message : String(error));
			}
		},
		"thinking.set": async (payload) => {
			const body = payload;
			const level = body?.level;
			if (typeof level !== "string" || level === "") fail("level is required");
			const raw = body?.budget;
			if (raw !== void 0 && raw !== null && typeof raw !== "number") fail("budget must be a number");
			const value = raw === void 0 || raw === null ? void 0 : raw;
			try {
				return { budgets: thinkingBudget.set(level, value) };
			} catch (error) {
				fail(error instanceof Error ? error.message : String(error));
			}
		},
		"stats.get": async () => statsView(),
		"multimodal.get": async () => multimodal.get(),
		"multimodal.set": async (payload) => {
			const raw = payload?.maxInlineMb;
			if (raw !== void 0 && raw !== null && typeof raw !== "number") fail("maxInlineMb must be a number");
			const value = raw === void 0 || raw === null ? void 0 : raw;
			try {
				return multimodal.set(value);
			} catch (error) {
				fail(error instanceof Error ? error.message : String(error));
			}
		},
		"ui.prefs.get": async () => uiPrefs.get(),
		"ui.prefs.set": async (payload) => {
			const body = payload;
			if (body?.conversationBadge !== void 0 && typeof body.conversationBadge !== "boolean") fail("conversationBadge must be a boolean");
			if (body?.detailedQuotaReset !== void 0 && typeof body.detailedQuotaReset !== "boolean") fail("detailedQuotaReset must be a boolean");
			return uiPrefs.set({
				conversationBadge: body?.conversationBadge,
				detailedQuotaReset: body?.detailedQuotaReset
			});
		}
	};
	return {
		async call(method, payload) {
			const handler = methods[method];
			if (handler === void 0) fail(`unknown method: ${method}`);
			return handler(payload);
		},
		async handleCallback(params) {
			const code = params.get("code");
			const state = params.get("state");
			if (!code || !state) return {
				ok: false,
				error: "Missing code or state parameter"
			};
			const expected = pendingAuth.get(state);
			if (expected === void 0) return {
				ok: false,
				error: "Unknown or expired authorization — please start a new login."
			};
			pendingAuth.delete(state);
			const redirectUri = `${baseUrl()}/agy/oauth-callback`;
			const result = await exchangeAntigravity(code, state, redirectUri, expected.verifier);
			if (result.type === "failed") return {
				ok: false,
				error: result.error
			};
			await upsertImportedAccount(store, {
				accessToken: result.access,
				refreshToken: result.refresh.split("|")[0],
				tokenType: "Bearer",
				expiresAt: new Date(result.expires).toISOString(),
				authMethod: "oauth",
				email: result.email ?? null,
				projectId: result.projectId || null,
				clientId: result.clientId || null
			}, { overwriteExisting: true });
			return {
				ok: true,
				email: result.email ?? null
			};
		}
	};
}
//#endregion
//#region src/web/i18n.ts
const I18N_DICT = {
	en: {
		loginSuccessTitle: "Sign-in Successful",
		loginSuccessDesc: "Your Antigravity account has been authorized and saved.",
		loginFailedTitle: "Sign-in Failed",
		windowClosing: "This window will close automatically in a moment..."
	},
	zh: {
		loginSuccessTitle: "授权登录成功",
		loginSuccessDesc: "Antigravity 账号已成功接入并保存。",
		loginFailedTitle: "授权登录失败",
		windowClosing: "此窗口即将在 2 秒内自动关闭..."
	}
};
//#endregion
//#region src/web/page.ts
/**
* Browser-facing HTML for the agy OAuth callback.
*
* This is the only page agy serves. The account/statistics dashboard that used
* to live at `/agy` is gone: that surface is now the Settings section rendered
* by `src/client/` over the `/api/agy` RPC, so there is no longer a second UI to
* keep in step with it.
*
* The callback stays a real page because Google redirects the browser here.
*/
/**
* Escape text for an HTML text/attribute position.
*
* Every interpolation below except the static markup is attacker-influenced or
* upstream-influenced: `error` is the token endpoint's raw response body, and
* `email` comes from Google's userinfo. This page is served by the SAME web
* server, and therefore the same origin, as the DSH GUI — so injected script
* here would run with the GUI's session and could reach `/api/agy`
* (`account.exportAll` returns live credential blobs). That chain is why the
* escaping matters more than the narrow trigger suggests.
*
* Text in markup goes through {@link escapeHtml}; text inside the inline
* `<script>` goes through {@link jsonForInlineScript}. Neither is optional.
*/
function escapeHtml(value) {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/**
* Serialize a value for interpolation into the inline `<script>`.
*
* `JSON.stringify` escapes for a JS string context only, NOT for the HTML script
* data state: it leaves `<` alone, so an email or error body containing
* `<\/script>` terminates the element early and everything after it is parsed as
* markup. Escaping the three HTML-significant characters as `\uXXXX` keeps the
* JSON value identical while making the byte sequence unrepresentable in the
* source. (The `JSON.stringify` output above is a valid JS string either way,
* because a `\u003c` escape and a literal `<` denote the same character.)
*/
function jsonForInlineScript(value) {
	return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
function renderCallbackHtml(options) {
	const { ok, error, email, baseUrl } = options;
	const i18nJson = jsonForInlineScript(I18N_DICT);
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Antigravity Sign-in</title>
  <style>
    :root {
      color-scheme: light dark;
      --dsw-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      --bg-page: #0f1115;
      --bg-surface: #171a21;
      --border-l2: rgba(255, 255, 255, 0.12);
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --brand-primary: #5686fe;
      --state-success: #34d399;
      --state-error: #f87171;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg-page: #f8fafc;
        --bg-surface: #ffffff;
        --border-l2: rgba(0, 0, 0, 0.12);
        --text-primary: #0f172a;
        --text-secondary: #475569;
        --brand-primary: #4176e6;
        --state-success: #22c55e;
        --state-error: #ef4444;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--dsw-font-family);
      background-color: var(--bg-page);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-l2);
      border-radius: 12px;
      padding: 24px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 24px;
    }
    .icon-success { background: rgba(52, 211, 153, 0.15); color: var(--state-success); }
    .icon-error { background: rgba(248, 113, 113, 0.15); color: var(--state-error); }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 13.5px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      height: 34px;
      padding: 0 16px;
      border-radius: 17px;
      border: 1px solid var(--border-l2);
      background: transparent;
      color: var(--text-primary);
      cursor: pointer;
      text-decoration: none;
    }
    .btn:hover { background: rgba(128, 128, 128, 0.1); }
    .btn-primary { background: var(--brand-primary); color: #ffffff; border-color: transparent; }
  </style>
</head>
<body>
  <div class="card">
    ${ok ? `
      <div class="icon-wrap icon-success">✓</div>
      <h1 id="title">Sign-in Successful</h1>
      <p id="desc">Your Antigravity account ${email ? "<strong>" + escapeHtml(email) + "</strong> " : ""}has been authorized and saved.</p>
      <p style="font-size:12px;opacity:0.8;" id="closing">This window will close automatically...</p>
      <button class="btn" onclick="window.close()">Close Window</button>
    ` : `
      <div class="icon-wrap icon-error">✕</div>
      <h1 id="title">Sign-in Failed</h1>
      <p id="desc">Error details: ${escapeHtml(error || "Unknown error")}</p>
      <a class="btn btn-primary" href="${escapeHtml(baseUrl)}/">Return to Settings</a>
    `}
  </div>
  <script>
    const I18N = ${i18nJson};
    const lang = localStorage.getItem('agy_lang') || (navigator.language.startsWith('zh') ? 'zh' : 'en');
    const dict = I18N[lang] || I18N.en;

    if (${ok ? "true" : "false"}) {
      document.getElementById('title').textContent = dict.loginSuccessTitle;
      // textContent, not innerHTML: an email containing markup must never be
      // parsed as HTML. The string itself is serialized for the script data
      // state by jsonForInlineScript, so it cannot terminate this element.
      document.getElementById('desc').textContent = dict.loginSuccessDesc + (${jsonForInlineScript(email ? " (" + email + ")" : "")});
      document.getElementById('closing').textContent = dict.windowClosing;
      
      // Notify parent window & close
      try {
        if (window.opener) {
          // Target this page's own origin rather than '*', so the message cannot
          // be delivered to an unrelated opener.
          window.opener.postMessage({ type: 'agy_login_success' }, window.location.origin);
        }
      } catch (e) {}
      setTimeout(() => {
        window.close();
      }, 1800);
    } else {
      document.getElementById('title').textContent = dict.loginFailedTitle;
    }
  <\/script>
</body>
</html>`;
}
//#endregion
//#region src/web/plugin.ts
const name = "dsh-agy-web";
/** The one service every composition provides; the rest are resolved lazily. */
const inject = ["llm"];
/** Bind hosts that mean "this machine only". */
const LOOPBACK_HOSTS = [
	"127.0.0.1",
	"localhost",
	"::1",
	"[::1]"
];
/**
* Whether a socket peer is on the loopback interface.
*
* The OAuth callback is gated on the PEER rather than on the bind address: a
* LAN-bound server must still answer the redirect that completes a login
* started in the local GUI, and `0.0.0.0` listeners see loopback peers as
* `127.0.0.1` (or `::ffff:127.0.0.1` when the socket is dual-stack).
* @param address - `req.socket.remoteAddress`, undefined when unavailable.
* @returns true only for a loopback peer; an unknown address is refused.
*/
function isLoopbackPeer(address) {
	if (address === void 0) return false;
	return address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127.");
}
/**
* Format a host for an HTTP URL, mapping wildcard listeners to loopback.
*
* An OAuth redirect must name a reachable loopback address. Wildcard listen
* addresses (`0.0.0.0`, or IPv6 `::` in either bracketed or bare form) map to
* loopback (`127.0.0.1` and `[::1]`). Bare IPv6 addresses (e.g. `::1`) are
* wrapped in brackets so `new URL` accepts them.
* @param host - the bind host.
* @returns the host to build the redirect from.
*/
function redirectHostFor(host) {
	if (host === "0.0.0.0") return "127.0.0.1";
	if (host === "::" || host === "[::]" || host === "::1") return "[::1]";
	if (host.includes(":") && !host.startsWith("[")) return `[${host}]`;
	return host;
}
/**
* The loopback base URL the OAuth redirect and the callback page point at.
*
* The port is the one the server BOUND, not the one it was asked for.
* `webStartup.port` is the `--port` flag verbatim, and `--port 0` — which asks
* the OS for any free port — would send Google's redirect to
* `http://127.0.0.1:0/agy/oauth-callback`, which nothing answers.
* The requested port and DSH's own 3080 default only stand in while the
* server has not reported one.
* @param host - loopback host the URL names.
* @param webServer - the host web server (source of the bound port).
* @param requestedPort - `webStartup.port`, the `--port` flag if one was given.
* @returns `http://<host>:<port>`, no trailing slash.
*/
function webBaseUrl(host, webServer, requestedPort) {
	return `http://${host}:${webServer.port || requestedPort || 3080}`;
}
function apply(ctx) {
	if (isAgyDisabled()) {
		ctx.logger.warn("[dsh-agy] disabled by DSH_AGY_DISABLE=1 — skipping web registration");
		return;
	}
	ctx.inject(["webServer"], (webCtx) => {
		const webServer = webCtx.get("webServer");
		if (!webServer) return;
		webCtx.effect(() => registerAgyWeb(webCtx, webServer));
	});
}
/**
* Register the OAuth callback route, and the management RPC once `connection`
* appears.
* @param ctx - the web-server-bearing context (owns both registrations).
* @param webServer - the host web server.
* @returns disposer for every registration this function made.
*/
async function registerAgyWeb(ctx, webServer) {
	const webStartup = ctx.get("webStartup");
	const host = webStartup?.host ?? "127.0.0.1";
	const bindHost = webServer.host ?? host;
	if (!LOOPBACK_HOSTS.includes(bindHost)) ctx.logger.warn("[dsh-agy] web server bound to \"" + bindHost + "\" (non-loopback): management RPC registered via /api/*, but OAuth callback accepts requests from loopback peers only.");
	const { store, sessions, adapter, stats, recentStore, modelVisibility, thinkingBudget, multimodalConfig } = await createAgyRuntime(ctx);
	const baseUrl = () => webBaseUrl(redirectHostFor(bindHost), webServer, webStartup?.port);
	const management = createAgyManagement({
		store,
		sessions,
		stats,
		recentRequests: () => recentStore.recentRequests(),
		modelVisibility,
		thinkingBudget: {
			all: () => thinkingBudget.all(),
			set: (level, value) => thinkingBudget.setBudget(level, value),
			claude: () => thinkingBudget.claudeBudget(),
			setClaude: (value) => thinkingBudget.setClaudeBudget(value).claudeBudget,
			tiered: () => thinkingBudget.tieredBudget(),
			setTiered: (value) => thinkingBudget.setTieredBudget(value).tieredBudget
		},
		multimodal: {
			get: () => multimodalConfig.snapshot(),
			set: (value) => multimodalConfig.setMaxInlineMb(value)
		},
		listAllModels: () => adapter.listAllModels(),
		invalidateModelCache: () => adapter.invalidateModelCache(),
		baseUrl,
		notifyModelsChanged: () => {
			ctx.emit("llm/adapters-updated");
		}
	});
	const disposers = [];
	disposers.push(webServer.register({
		kind: "exact",
		path: "/agy/oauth-callback",
		handler: async (req, res) => {
			const base = baseUrl();
			if (!isLoopbackPeer(req.socket.remoteAddress)) {
				ctx.logger.warn(`[dsh-agy] rejected OAuth callback request from non-loopback peer ${req.socket.remoteAddress ?? "unknown"}`);
				res.writeHead(403, { "content-type": "text/html; charset=utf-8" });
				res.end(renderCallbackHtml({
					ok: false,
					error: "Forbidden: OAuth callback only accepts requests from loopback peers.",
					baseUrl: base
				}));
				return;
			}
			let url;
			try {
				url = new URL(req.url ?? "/", base);
			} catch {
				res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
				res.end(renderCallbackHtml({
					ok: false,
					error: "Invalid callback URL",
					baseUrl: base
				}));
				return;
			}
			const result = await management.handleCallback(url.searchParams).catch((error) => ({
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			}));
			res.writeHead(result.ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
			res.end(result.ok ? renderCallbackHtml({
				ok: true,
				email: result.email ?? null,
				baseUrl: base
			}) : renderCallbackHtml({
				ok: false,
				error: result.error ?? "Unknown error",
				baseUrl: base
			}));
		}
	}));
	ctx.inject(["connection"], (connectionCtx) => {
		const connection = connectionCtx.get("connection");
		if (!connection || typeof connection.fetch?.register !== "function") {
			connectionCtx.logger.warn("[dsh-agy] connection.fetch unavailable — management RPC not registered");
			return;
		}
		connectionCtx.effect(() => connection.fetch.register({
			path: "/api/agy",
			methods: ["POST"],
			requestBody: "buffered",
			async fetch(request) {
				if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
				if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return new Response("content type must be application/json", { status: 415 });
				let message;
				try {
					message = await request.json();
				} catch {
					return new Response("body is not JSON", { status: 400 });
				}
				const rpcId = typeof message.rpcId === "string" ? message.rpcId : "invalid-request";
				const call = message.payload;
				if (message.type !== "client-request" || typeof message.rpcId !== "string" || typeof call?.method !== "string") return reply(rpcId, {
					ok: false,
					error: {
						code: "agy/bad-request",
						message: "Invalid agy management request."
					}
				});
				try {
					return reply(rpcId, {
						ok: true,
						value: await management.call(call.method, call.payload)
					});
				} catch (error) {
					const text = error instanceof Error ? error.message : String(error);
					connectionCtx.logger.warn(`[dsh-agy] ${call.method} failed: ${text}`);
					return reply(rpcId, {
						ok: false,
						error: {
							code: "agy/handler-failed",
							message: text
						}
					});
				}
			}
		}), "dsh-agy: /api/agy management RPC");
	});
	return () => {
		for (const dispose of disposers) dispose();
	};
}
/**
* Wrap one result in the Connection RPC response envelope.
*
* A failure MUST carry `error.details` as an object: the client's envelope
* parser rejects a failure without it as "invalid server-response", which hides
* the real message behind a transport-sounding error.
*/
function reply(rpcId, result) {
	const normalized = isFailure(result) ? {
		...result,
		error: {
			details: {},
			...result.error
		}
	} : result;
	return Response.json({
		type: "server-response",
		rpcId,
		result: normalized
	});
}
/** Whether one result is an RPC failure envelope. */
function isFailure(value) {
	return typeof value === "object" && value !== null && value.ok === false && typeof value.error === "object" && value.error !== null;
}
//#endregion
export { apply, inject, isLoopbackPeer, name, redirectHostFor, webBaseUrl };

//# sourceMappingURL=plugin.mjs.map