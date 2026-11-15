import { D as UA_TEMPLATE_VERSION_TOKEN, E as UA_TEMPLATE_PLATFORM_TOKEN, O as isValidUaTemplate, _ as currentHubVersion, b as setProfileUserAgentRenderer, d as agyCliUserAgent, f as agyHubUserAgent, g as currentCliVersion } from "./constants-Bp77vPy6.mjs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Document, isMap, isScalar, parseDocument } from "yaml";
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
const ENC_PREFIX = "enc:v1:";
/** AES-256-GCM codec; ciphertext format `enc:v1:<iv-b64>:<tag-b64>:<data-b64>`. */
function createAesGcmCodec(key) {
	if (key.length !== 32) throw new Error(`createAesGcmCodec: master key must be 32 bytes, got ${key.length}`);
	return {
		encrypt(plaintext) {
			const iv = randomBytes(12);
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
			const tag = cipher.getAuthTag();
			return `${ENC_PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${data.toString("base64url")}`;
		},
		decrypt(payload) {
			if (!payload.startsWith(ENC_PREFIX)) throw new Error("decrypt: payload is not in encrypted format");
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
* How long a hot-path read may serve the in-memory copy before re-checking the
* file. One second keeps a settings change effectively immediate to the user
* while collapsing a per-request read into at most one per second.
*/
const DEFAULT_REVALIDATE_INTERVAL_MS = 1e3;
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
/** Platform token this client advertises: the Go-style pair the UA vocabulary uses. */
const DEFAULT_UA_PLATFORM = "darwin/arm64";
/** Fill a custom template's placeholders. */
function renderUaTemplate(template, version, platform = DEFAULT_UA_PLATFORM) {
	return template.split(UA_TEMPLATE_VERSION_TOKEN).join(version).split(UA_TEMPLATE_PLATFORM_TOKEN).join(platform);
}
/** Whether a profile id names a built-in. */
function isBuiltinUaProfile(id) {
	return id === "hub" || id === "cli";
}
/** The kind a profile id names; `custom` otherwise. */
function uaProfileKind(id) {
	if (id === "hub") return "hub";
	if (id === "cli") return "cli";
	return "custom";
}
/** The version line a profile id draws from. */
function uaProfileVersionLine(id) {
	if (id === "hub") return "2.x";
	if (id === "cli") return "1.x";
	return "custom";
}
/**
* The version an arbitrary line token resolves to.
*
* Only the two lines this client actually claims can be resolved; a custom
* profile naming anything else falls back to the hub version, because a
* custom shape is by definition an experiment and an unresolvable line must
* still produce a servable string.
*/
function versionForLine(line) {
	if (line === "2.x") return currentHubVersion();
	if (line === "1.x" || line === "cli") return currentCliVersion();
	return currentHubVersion();
}
/** Move any well-formed custom profile through, dropping unusable ones. */
function sanitizeCustomProfiles(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
	const out = {};
	for (const [id, value] of Object.entries(raw)) {
		if (typeof value !== "object" || value === null) continue;
		const entry = value;
		if (isBuiltinUaProfile(id)) continue;
		if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(id)) continue;
		const template = entry.template;
		if (!isValidUaTemplate(template)) continue;
		out[id] = {
			label: typeof entry.label === "string" && entry.label.trim() !== "" ? entry.label.trim().slice(0, 60) : id,
			template,
			versionLine: typeof entry.versionLine === "string" && entry.versionLine !== "" ? entry.versionLine.slice(0, 16) : "custom"
		};
	}
	return out;
}
function parseUaProfileDocument(text) {
	let raw;
	try {
		raw = JSON.parse(text);
	} catch {
		return {
			version: 1,
			active: "hub",
			custom: {}
		};
	}
	const record = typeof raw === "object" && raw !== null ? raw : {};
	const custom = sanitizeCustomProfiles(record.custom);
	const candidate = typeof record.active === "string" ? record.active : "";
	return {
		version: 1,
		active: isBuiltinUaProfile(candidate) ? candidate : candidate !== "" && custom[candidate] !== void 0 ? candidate : "hub",
		custom
	};
}
/**
* In-memory authoritative copy of the profile, backed by a JSON file.
*
* `userAgent()` sits on the generation hot path (a header set is assembled per
* request), so the cross-instance revalidation is rate-limited exactly as
* `ThinkingBudgetStore` does it, and the WRITE path bypasses the limit so a
* concurrent edit is never merged into a stale copy.
*/
var UaProfileStore = class UaProfileStore {
	file;
	revalidateIntervalMs;
	doc;
	raw;
	checkedAt;
	constructor(options = {}) {
		this.file = options.file ?? migrateToAgyDir("agy-ua-profile.json").file;
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
	readWithRaw() {
		try {
			const raw = readFileSync(this.file, "utf8");
			return {
				doc: parseUaProfileDocument(raw),
				raw
			};
		} catch {
			return {
				doc: {
					version: 1,
					active: "hub",
					custom: {}
				},
				raw: ""
			};
		}
	}
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
	reloadIfChanged() {
		if (Date.now() - this.checkedAt < this.revalidateIntervalMs) return;
		this.reloadNow();
	}
	write(mutate) {
		this.reloadNow();
		const next = {
			version: 1,
			active: this.doc.active,
			custom: { ...this.doc.custom }
		};
		mutate(next);
		const text = UaProfileStore.serialize(next);
		mkdirSync(dirname(this.file), { recursive: true });
		const tmp = `${this.file}.tmp`;
		writeFileSync(tmp, text, { mode: 384 });
		renameSync(tmp, this.file);
		this.doc = next;
		this.raw = text;
	}
	/** Id of the profile in force. */
	activeId() {
		this.reloadIfChanged();
		return this.doc.active;
	}
	/** The active profile's kind. */
	activeKind() {
		return uaProfileKind(this.activeId());
	}
	/** The version line the active profile draws from. */
	activeVersionLine() {
		const id = this.activeId();
		if (isBuiltinUaProfile(id)) return uaProfileVersionLine(id);
		return this.doc.custom[id]?.versionLine ?? "2.x";
	}
	/**
	* The active profile's version, resolved for ITS OWN line.
	*
	* This is the load-bearing part: the caller must never hand a CLI-line
	* number to the hub shape or vice versa, because a mismatched pair is
	* exactly what produces the retirement notice and the missing Gemini group.
	*/
	activeVersion() {
		return versionForLine(this.activeVersionLine());
	}
	/** One custom profile, when it exists. */
	customProfile(id) {
		this.reloadIfChanged();
		return this.doc.custom[id];
	}
	/**
	* Render the UA for the active profile.
	*
	* @param options.platform - platform token; defaults to the recorded pair.
	* @param options.version - override the version (callers that already
	*   resolved the CORRECT line; used by the fingerprint migration, which must
	*   preserve the version a stored identity already had).
	*/
	userAgent(options = {}) {
		this.reloadIfChanged();
		const platform = options.platform ?? "darwin/arm64";
		const id = this.doc.active;
		if (id === "hub") return agyHubUserAgent(options.version ?? currentHubVersion(), platform);
		if (id === "cli") return agyCliUserAgent(options.version ?? currentCliVersion(), platform);
		const custom = this.doc.custom[id];
		if (custom === void 0) return agyHubUserAgent(options.version ?? currentHubVersion(), platform);
		return renderUaTemplate(custom.template, options.version ?? versionForLine(custom.versionLine), platform);
	}
	/** Every selectable profile, for the settings card. */
	profiles(options = {}) {
		this.reloadIfChanged();
		const platform = options.platform ?? "darwin/arm64";
		const views = [{
			id: "hub",
			kind: "hub",
			label: "Antigravity Hub",
			versionLine: "2.x",
			example: agyHubUserAgent(currentHubVersion(), platform)
		}, {
			id: "cli",
			kind: "cli",
			label: "Antigravity CLI (agy)",
			versionLine: "1.x",
			example: agyCliUserAgent(currentCliVersion(), platform)
		}];
		for (const [id, custom] of Object.entries(this.doc.custom)) views.push({
			id,
			kind: "custom",
			label: custom.label,
			versionLine: custom.versionLine,
			example: renderUaTemplate(custom.template, versionForLine(custom.versionLine), platform)
		});
		return views;
	}
	/**
	* What the settings card renders.
	*
	* `versionSource` distinguishes a live-resolved version from the shipped
	* floor, so a stale-looking number is attributable to a failed feed read
	* rather than to the profile.
	*/
	view(options = {}) {
		const platform = options.platform ?? "darwin/arm64";
		return {
			profiles: this.profiles({ platform }),
			active: this.activeId(),
			effective: this.userAgent({ platform }),
			versionSource: options.versionSource ?? "fallback"
		};
	}
	/** Switch the active profile. Throws when the id names nothing. */
	setActive(id) {
		this.write((doc) => {
			if (!isBuiltinUaProfile(id) && doc.custom[id] === void 0) throw new Error(`unknown UA profile: ${id}`);
			doc.active = id;
		});
		return this.view();
	}
	/**
	* Create or replace a custom profile.
	*
	* Re-using an existing custom id replaces it in place (which is how a
	* template is edited), while a built-in id is refused because shadowing it
	* would break the switch-back path.
	*/
	setCustom(input) {
		if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(input.id)) throw new Error("UA profile id must match ^[a-z0-9][a-z0-9-]{0,31}$");
		if (isBuiltinUaProfile(input.id)) throw new Error(`"${input.id}" is a built-in profile and cannot be redefined`);
		if (!isValidUaTemplate(input.template)) throw new Error(`UA template must be 1-512 characters, contain ${UA_TEMPLATE_VERSION_TOKEN}, and carry no control characters`);
		const label = input.label?.trim().slice(0, 60) || input.id;
		const versionLine = input.versionLine?.slice(0, 16) || "custom";
		this.write((doc) => {
			doc.custom[input.id] = {
				label,
				template: input.template,
				versionLine
			};
		});
		return this.view();
	}
	/** Delete a custom profile; the active one falls back to the default. */
	deleteCustom(id) {
		if (isBuiltinUaProfile(id)) throw new Error(`"${id}" is a built-in profile and cannot be deleted`);
		this.write((doc) => {
			delete doc.custom[id];
			if (doc.active === id) doc.active = "hub";
		});
		return this.view();
	}
	/** The raw document, for tests and export. */
	snapshot() {
		this.reloadIfChanged();
		return {
			version: 1,
			active: this.doc.active,
			custom: { ...this.doc.custom }
		};
	}
};
/**
* Process-wide profile: the identity every UA builder reads.
*
* WHY A MODULE-LEVEL SINGLETON. UA construction happens in dependency leaves
* (`runtime/fingerprint.ts`, the model/quota probes, the OAuth exchange) that
* receive no runtime object, and threading a store through every call site
* would either create a cycle or push the store into the CLI's dependency
* graph. The store is therefore resolved ONCE, lazily, from the default path —
* and because the file is content-compared on the hot path, a settings write in
* the web entry is visible to the main plugin in the same process without any
* wiring.
*/
let sharedProfile;
/** The process-wide profile store (created on first use). */
function uaProfileStore() {
	sharedProfile ??= new UaProfileStore();
	return sharedProfile;
}
/**
* Bind this module as the renderer behind `getAgyBootstrapUserAgent`.
*
* Registration happens at import time so it cannot be skipped by a code path
* that builds a bootstrap UA before a store exists: the module IS the store's
* home, so loading it is enough. It renders through the process-wide profile, so
* a settings switch reaches the next bootstrap call in this process immediately
* (the store content-compares its file on the hot path).
*/
setProfileUserAgentRenderer((version) => uaProfileStore().userAgent(version === void 0 ? {} : { version }));
/**
* The UA this process presents right now.
*
* ONE entry point for every surface that must not self-identify: generation
* headers (via the fingerprint), model discovery, the quota summary probe, the
* OAuth bootstrap calls, and the CLI's import enrichment. They must all agree,
* because two different client strings from one process is the anomaly this
* whole module exists to avoid — and on this channel a disagreement is also
* functional: the quota endpoint returns a different GROUP SET per line.
*/
function activeUserAgent(options = {}) {
	return uaProfileStore().userAgent(options);
}
//#endregion
export { resolveDshHome as _, ThinkingBudgetStore as a, THINKING_BUDGET_MAX as c, MASTER_KEY_REF as d, assertOwnerOnly as f, persistMasterKey as g, loadMasterKey as h, DEFAULT_REVALIDATE_INTERVAL_MS as i, agyDataFile as l, deriveKey as m, activeUserAgent as n, CLAUDE_BUDGET_MAX as o, createAesGcmCodec as p, uaProfileStore as r, CLAUDE_BUDGET_MIN as s, UaProfileStore as t, migrateToAgyDir as u, resolveMasterKeyCodec as v };

//# sourceMappingURL=ua-profile-D3dQc_Nn.mjs.map