import type { RequestHandler } from "express";

export const preventAuthenticationResponseCaching: RequestHandler = (req, res, next) => {
  // Express can still answer 304 from If-None-Match even with Cache-Control: no-store.
  // Auth clients need a body on every session check, so ignore conditional validators.
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};