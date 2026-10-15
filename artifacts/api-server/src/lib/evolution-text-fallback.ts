export const sendTextWithQuoteFallback = async <ResponseLike extends {
  ok: boolean;
  status: number;
}>(
  send: (includeQuote: boolean) => Promise<ResponseLike>,
  hasQuote: boolean,
) => {
  const response = await send(hasQuote);
  if (hasQuote && !response.ok && response.status === 400) {
    return send(false);
  }
  return response;
};
