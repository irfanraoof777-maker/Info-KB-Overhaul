import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent browsers from caching API responses. Without this, a browser that
// receives an HTML error page (e.g. from the Replit proxy when the service is
// temporarily down) will serve that stale HTML from cache on all subsequent
// fetch() calls — even after the server is healthy again.
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Mount at /api (direct access: localhost:8080/api/admin/...)
// Mount at /   (Replit proxy strips the /api prefix before forwarding)
app.use("/api", router);
app.use("/", router);

export default app;
