export type SyncErrorCode =
  | 'AUTH_MISSING'
  | 'AUTH_EXPIRED'
  | 'GITHUB_API'
  | 'GITHUB_RATE_LIMIT'
  | 'NPM_API'
  | 'GHCR_API'
  | 'CONFIG_INVALID'
  | 'CONFIG_NOT_FOUND'
  | 'PLAN_EMPTY'
  | 'APPLY_FAILED'
  | 'APPLY_PARTIAL'
  | 'INPUT_UNKNOWN_COMMAND'
  | 'INPUT_INVALID_FILE'
  | 'INPUT_FILE_NOT_FOUND'
  | 'RUNTIME_UNKNOWN';

export class SyncError extends Error {
  readonly code: SyncErrorCode;
  readonly hint: string;
  readonly cause?: Error;
  readonly retryable: boolean;

  constructor(
    code: SyncErrorCode,
    message: string,
    hint: string,
    options?: { cause?: Error; retryable?: boolean },
  ) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.hint = hint;
    this.cause = options?.cause;
    this.retryable = options?.retryable ?? false;
  }

  toCliText(): string {
    return `Error [${this.code}]: ${this.message}\nHint: ${this.hint}`;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      hint: this.hint,
      retryable: this.retryable,
    };
  }
}

export function wrapError(
  err: unknown,
  code: SyncErrorCode,
  hint: string,
): SyncError {
  const cause = err instanceof Error ? err : new Error(String(err));
  return new SyncError(code, cause.message, hint, { cause });
}
