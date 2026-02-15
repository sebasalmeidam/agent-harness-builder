import { app } from "./app.js";
import { cleanupZombieRuns } from "./services/run-service.js";

const port = Number(process.env["PORT"] ?? 4099);

app.listen(port, async () => {
  console.log(`Server listening on http://localhost:${port}`);

  // Clean up any runs that were "running" when server last stopped
  const cleaned = await cleanupZombieRuns();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} zombie run(s) from previous session`);
  }
});
