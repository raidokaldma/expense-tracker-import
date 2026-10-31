export class NotFoundError extends Error {}

/** The request asks for something that can't be done, e.g. a bank Enable Banking doesn't offer. */
export class InvalidRequestError extends Error {}

export class LoginError extends Error {}

export class BankUnavailableError extends Error {}
