export type ErrorCode =
  | "GENERAL_ERROR"
  | "INVALID_ARGUMENTS"
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_FAILED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "REMOTE_API_ERROR";

const exitCodes: Record<ErrorCode, number> = {
  GENERAL_ERROR: 1,
  INVALID_ARGUMENTS: 2,
  AUTHENTICATION_FAILED: 3,
  AUTHORIZATION_FAILED: 4,
  NOT_FOUND: 5,
  RATE_LIMITED: 6,
  NETWORK_ERROR: 7,
  REMOTE_API_ERROR: 8
};

export class CliError extends Error {
  readonly code: ErrorCode;
  readonly hint: string | undefined;
  readonly exitCode: number;

  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.hint = hint;
    this.exitCode = exitCodes[code];
  }
}

export function toErrorEnvelope(error: unknown): { error: { code: string; message: string; hint?: string } } {
  if (error instanceof CliError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.hint ? { hint: error.hint } : {})
      }
    };
  }

  return {
    error: {
      code: "GENERAL_ERROR",
      message: error instanceof Error ? error.message : String(error)
    }
  };
}

export function exitCodeFor(error: unknown): number {
  return error instanceof CliError ? error.exitCode : 1;
}
