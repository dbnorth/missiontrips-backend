import routes from "./app/routes/index.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import db from "./app/models/index.js";
import logger from "./app/config/logger.js";
import { ensureSchema } from "./app/scripts/ensureSchema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const syncOptions =
  process.env.SEQUELIZE_SYNC_ALTER === "true" || process.env.SEQUELIZE_SYNC_ALTER === "1"
    ? { alter: true }
    : {};

db.sequelize
  .sync(syncOptions)
  .then(() => ensureSchema())
  .then(() => {
    if (syncOptions.alter) {
      logger.info("Database sync completed with alter: true.");
    }
  })
  .catch((err) => {
    logger.error(`Database sync failed: ${err.message}`);
    process.exit(1);
  });

const app = express();

app.use(morgan("combined", { stream: logger.stream }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:8082",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/missiontrips/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/missiontrips", routes);

const PORT = process.env.PORT || 3200;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`Mission Trips Server is running on port ${PORT}`);
  });
}

export { logger };
export default app;
