import { BankUnavailableError, InvalidRequestError, LoginError, NotFoundError } from '../errors.ts';

/** A malformed request, rejected before it reaches the service. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The status for an expected error; null for an unexpected one, which is logged and answered with 500. */
export function statusOf(err: unknown) {
  if (err instanceof HttpError) return err.status;
  if (err instanceof LoginError) return 400;
  if (err instanceof NotFoundError) return 404;
  if (err instanceof InvalidRequestError) return 422;
  if (err instanceof BankUnavailableError) return 502;
  return null;
}
