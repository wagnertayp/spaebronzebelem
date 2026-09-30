import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env["NODE_ENV"] === "production") {
  const spaBuildDirectory = fileURLToPath(
    new URL("../../spa-bronze-belem/dist/public/", import.meta.url),
  );
  const spaIndexPath = resolve(spaBuildDirectory, "index.html");

  if (!existsSync(spaIndexPath)) {
    throw new Error(
      `SPA production build is missing: ${spaIndexPath}. Run the Heroku postbuild before starting the API.`,
    );
  }

  app.use(express.static(spaBuildDirectory));
  app.use((req, res, next) => {
    const isApiRequest = req.path === "/api" || req.path.startsWith("/api/");
    if (req.method !== "GET" || isApiRequest) return next();
    return res.sendFile(spaIndexPath, (error) => {
      if (error) next(error);
    });
  });
}

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  logger.error(
    { err: error, method: req.method, path: req.path },
    "Unhandled request error",
  );
  if (res.headersSent) {
    next(error);
    return;
  }

  const candidate = error as { status?: unknown; statusCode?: unknown };
  const errorStatus = candidate.statusCode ?? candidate.status;
  const statusCode =
    typeof errorStatus === "number" && errorStatus >= 400 && errorStatus < 500
      ? errorStatus
      : 500;
  res.status(statusCode).json({
    error:
      statusCode === 500
        ? "Erro interno do servidor."
        : "Não foi possível processar a requisição.",
  });
};

app.use(errorHandler);

export default app;
