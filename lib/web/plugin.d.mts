import { IncomingMessage, ServerResponse } from "node:http";
import { Context } from "@deepseek-ai/cordis";
//#region src/web/plugin.d.ts
declare const name = "dsh-agy-web";
/** The one service every composition provides; the rest are resolved lazily. */
declare const inject: string[];
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
declare function isLoopbackPeer(address: string | undefined): boolean;
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
declare function redirectHostFor(host: string): string;
/** The slice of the host's web-server service this entry uses. */
interface WebServerLike {
  register(route: {
    kind: 'exact';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void;
  }): () => void;
  host?: string;
  /** The port actually listened on: the OS-assigned one when `--port 0`. */
  readonly port?: number;
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
declare function webBaseUrl(host: string, webServer: Pick<WebServerLike, 'port'>, requestedPort?: number): string;
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, isLoopbackPeer, name, redirectHostFor, webBaseUrl };
//# sourceMappingURL=plugin.d.mts.map