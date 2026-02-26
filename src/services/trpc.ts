import type { ServerTrpcClient, CentralTrpcClient } from '../types/trpc.js';

/**
 * Creates a proxy-based tRPC-like client that maps nested property access
 * to HTTP calls: `client.messages.list.query(input)` → POST /trpc/messages.list
 */
function createTrpcProxy(baseUrl: string, getToken: () => string | null): unknown {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === 'query' || prop === 'mutate') {
        return async (input?: unknown) => {
          const path = (_target as { __path?: string[] }).__path ?? [];
          const procedurePath = path.join('.');
          const url = `${baseUrl}/trpc/${procedurePath}`;

          const token = getToken();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const isQuery = prop === 'query';
          let response: Response;

          if (isQuery) {
            const queryInput =
              input !== undefined
                ? `?input=${encodeURIComponent(JSON.stringify(input))}`
                : '';
            response = await fetch(`${url}${queryInput}`, {
              method: 'GET',
              headers,
            });
          } else {
            response = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(input ?? {}),
            });
          }

          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            throw new TrpcError(
              'RATE_LIMITED',
              'Too many requests',
              429,
              retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
            );
          }

          const json = await response.json();

          if (!response.ok) {
            const errData = json?.error ?? json;
            throw new TrpcError(
              errData?.code ?? (response.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR'),
              errData?.message ?? (response.status === 401 ? 'Authentication required' : 'Request failed'),
              response.status,
              errData?.data?.retry_after,
              errData?.data?.ecto_code,
            );
          }

          // tRPC wraps results in { result: { data: ... } }
          return json?.result?.data ?? json;
        };
      }

      const currentPath = ((_target as { __path?: string[] }).__path ?? []).concat(prop);
      const child: Record<string, unknown> = { __path: currentPath };
      return new Proxy(child, handler);
    },
  };

  const root: Record<string, unknown> = { __path: [] };
  return new Proxy(root, handler);
}

class TrpcError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly retryAfter?: number,
    public readonly ectoCode?: number,
  ) {
    super(message);
    this.name = 'TrpcError';
  }
}

/** Create a tRPC client for a specific server */
export function createServerTrpcClient(
  baseUrl: string,
  getToken: () => string | null,
): ServerTrpcClient {
  return createTrpcProxy(baseUrl, getToken) as ServerTrpcClient;
}

/** Create a tRPC client for central services */
export function createCentralTrpcClient(
  baseUrl: string,
  getToken: () => string | null,
): CentralTrpcClient {
  return createTrpcProxy(baseUrl, getToken) as CentralTrpcClient;
}
