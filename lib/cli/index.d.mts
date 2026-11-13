import { Command } from "commander";
//#region src/oauth/constants.d.ts
/** Default loopback callback used by the standalone CLI listener (fixed port, like opencode). */
declare const AGY_DEFAULT_REDIRECT_URI = "http://localhost:51121/oauth-callback";
//#endregion
//#region src/cli/index.d.ts
/**
 * Write one exported credential blob to disk.
 *
 * 0600: a blob carries a live access+refresh token in plain base64. Every other
 * credential write in this repo sets an owner-only mode; this was the one
 * `writeFileSync` without it, so the default umask (0644) left the export
 * world-readable on a shared machine.
 */
declare function writeBlobFile(file: string, blob: string): void;
declare function createProgram(): Command;
//#endregion
export { AGY_DEFAULT_REDIRECT_URI, createProgram, writeBlobFile };
//# sourceMappingURL=index.d.mts.map