/**
 * Pull the message the server actually wrote out of a failed request.
 *
 * RestApiClient throws on any non-2xx, so a 422 never reaches an `if (!ok)`
 * branch - it lands in catch as "failed with status 422 Unprocessable Entity".
 * That is true and useless: the server said "this quote is in MYR but 1 line
 * item is priced in USD", and that is the sentence the person needs.
 *
 * The thrown error carries the parsed body, so dig the message out of it and
 * only fall back to the HTTP wording when there is genuinely nothing better.
 */
export const commandErrorMessage = (error: unknown, fallback: string) => {
  const body = (error as { body?: unknown } | null)?.body;

  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (body && typeof body === 'object') {
    const named = body as { error?: unknown; message?: unknown };

    if (typeof named.error === 'string' && named.error.length > 0) {
      return named.error;
    }

    if (typeof named.message === 'string' && named.message.length > 0) {
      return named.message;
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
};
