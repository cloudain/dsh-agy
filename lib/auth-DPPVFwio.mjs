//#region src/oauth/auth.ts
const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 6e4;
/** Split the packed refresh string into its constituent refresh token and project ids. */
function parseRefreshParts(refresh) {
	const [refreshToken = "", projectId = "", managedProjectId = ""] = (refresh ?? "").split("|");
	return {
		refreshToken: refreshToken || void 0,
		projectId: projectId || void 0,
		managedProjectId: managedProjectId || void 0
	};
}
/** Serialize refresh token parts into the stored string format. */
function formatRefreshParts(parts) {
	const projectSegment = parts.projectId ?? "";
	const base = `${parts.refreshToken ?? ""}|${projectSegment}`;
	return parts.managedProjectId ? `${base}|${parts.managedProjectId}` : base;
}
/** Whether the access token is expired or missing, with a buffer for clock skew. */
function accessTokenExpired(auth) {
	if (!auth.access || typeof auth.expires !== "number") return true;
	return auth.expires <= Date.now() + ACCESS_TOKEN_EXPIRY_BUFFER_MS;
}
/** Absolute expiry timestamp from a duration; malformed durations expire immediately. */
function calculateTokenExpiry(requestTimeMs, expiresInSeconds) {
	const seconds = typeof expiresInSeconds === "number" ? expiresInSeconds : 3600;
	if (Number.isNaN(seconds) || seconds <= 0) return requestTimeMs;
	return requestTimeMs + seconds * 1e3;
}
//#endregion
export { parseRefreshParts as i, calculateTokenExpiry as n, formatRefreshParts as r, accessTokenExpired as t };

//# sourceMappingURL=auth-DPPVFwio.mjs.map