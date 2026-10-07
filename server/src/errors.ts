export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string) => new HttpError(400, 'BAD_REQUEST', message);
export const unauthorized = (message = 'Log in to continue.') =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message: string) => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message: string) => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);

// Password salah saat membuka private key. Sengaja bukan 401, agar klien tidak
// menganggap sesi login berakhir.
export class WrongPasswordError extends HttpError {
  constructor() {
    super(403, 'WRONG_PASSWORD', 'Incorrect password.');
    this.name = 'WrongPasswordError';
  }
}
