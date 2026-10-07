import type {
  BenchmarkReport,
  FileItem,
  FileListing,
  PublicKeys,
  SelfTestReport,
  ServerParameters,
  TamperReport,
  Trace,
  User,
  UserSummary,
  VerificationResult,
} from '../types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const UNAUTHORIZED_EVENT = 'crypta:unauthorized';

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method, credentials: 'same-origin' };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Make sure the Crypta server is running.');
  }
  if (response.ok) return response;

  let code = 'UNKNOWN';
  let message = `Request failed (${response.status}).`;
  try {
    const data = await response.json();
    if (data?.error?.message) {
      code = data.error.code;
      message = data.error.message;
    }
  } catch {
    // Respons bukan JSON; pakai pesan bawaan.
  }
  if (response.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  throw new ApiError(response.status, code, message);
}

async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
  return (await request(method, path, body)).json() as Promise<T>;
}

function decodeTraceHeader(value: string | null): Trace | null {
  if (!value) return null;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Trace;
  } catch {
    return null;
  }
}

export const api = {
  register: (username: string, email: string, password: string) =>
    json<{ user: User; trace: Trace }>('POST', '/auth/register', { username, email, password }),
  login: (identifier: string, password: string) => json<{ user: User }>('POST', '/auth/login', { identifier, password }),
  logout: () => json<{ ok: true }>('POST', '/auth/logout'),
  me: () => json<{ user: User }>('GET', '/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    json<{ ok: true; trace: Trace }>('POST', '/auth/change-password', { currentPassword, newPassword }),

  searchUsers: (query: string) => json<{ users: UserSummary[] }>('GET', `/users/search?q=${encodeURIComponent(query)}`),
  publicKeys: (username: string) => json<PublicKeys>('GET', `/users/${encodeURIComponent(username)}/keys`),

  listFiles: () => json<FileListing>('GET', '/files'),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return json<{ file: FileItem; trace: Trace }>('POST', '/files', form);
  },
  deleteFile: (id: string) => json<{ ok: true; removed: 'file' | 'access' }>('DELETE', `/files/${id}`),
  downloadEncrypted: async (id: string) => (await request('GET', `/files/${id}/raw`)).blob(),
  decrypt: async (id: string, password: string) => {
    const response = await request('POST', `/files/${id}/decrypt`, { password });
    return { blob: await response.blob(), trace: decodeTraceHeader(response.headers.get('X-Crypta-Trace')) };
  },

  sign: (id: string, password: string) => json<{ file: FileItem; trace: Trace }>('POST', `/files/${id}/sign`, { password }),
  verify: (id: string, password: string) =>
    json<{ result: VerificationResult; trace: Trace }>('POST', `/files/${id}/verify`, { password }),
  downloadSignature: async (id: string) => (await request('GET', `/files/${id}/signature`)).blob(),
  verifyExternal: (file: File, signature: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('signature', signature);
    return json<{ result: VerificationResult; trace: Trace }>('POST', '/verify', form);
  },

  share: (id: string, username: string, password: string) =>
    json<{ file: FileItem; trace: Trace }>('POST', `/files/${id}/share`, { username, password }),
  revokeShare: (id: string, userId: string) => json<{ file: FileItem }>('DELETE', `/files/${id}/share/${userId}`),

  tamperTest: (id: string, password: string) => json<TamperReport>('POST', `/files/${id}/tamper-test`, { password }),
  selfTest: () => json<SelfTestReport>('GET', '/lab/selftest'),
  benchmark: () => json<BenchmarkReport>('GET', '/lab/benchmark'),
  parameters: () => json<ServerParameters>('GET', '/lab/parameters'),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unknown error occurred.';
}
