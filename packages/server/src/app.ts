import express from "express";
import { teamsRouter } from "./routes/teams.js";
import { projectsRouter } from "./routes/projects.js";
import { runsRouter } from "./routes/runs.js";
import { tasksRouter } from "./routes/tasks.js";
import { skillsRouter } from "./routes/skills.js";

const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/teams", teamsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/projects/:id/runs", runsRouter);
app.use("/api/projects/:id/tasks", tasksRouter);
app.use("/api/skills", skillsRouter);

export { app };
