// A transfer receipt must name exactly the lines still outstanding on the
// server. When the receive form was built from an older copy of the transfer
// (someone else received units since, or the same user did on another
// screen), the backend refuses it with this message. The transfer screens
// treat that as "reload the transfer and rebuild the form", never as a
// permission problem.

const STALE_RECEIVE = /exactly one line per outstanding transfer line/i

export function isStaleReceiveError(
  result: { message?: unknown; error?: unknown } | null | undefined
): boolean {
  const text = [result?.message, result?.error]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
  return STALE_RECEIVE.test(text)
}
