import express from "express";
import { teamsRouter } from "./routes/teams.js";

const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/teams", teamsRouter);

export { app };
