import express from "express";
import { teamsRouter } from "./routes/teams.js";
import { projectsRouter } from "./routes/projects.js";

const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/teams", teamsRouter);
app.use("/api/projects", projectsRouter);

export { app };
