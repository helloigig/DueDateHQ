import { router } from "./init.js";
import { aiInferencesRouter } from "./routers/aiInferences.js";
import {
  announcementsRouter,
  notificationsRouter,
} from "./routers/announcements.js";
import { authRouter } from "./routers/auth.js";
import { clientsRouter } from "./routers/clients.js";
import { deadlinesRouter } from "./routers/deadlines.js";
import { emailsRouter, reminderTemplatesRouter } from "./routers/emails.js";
import { exportsRouter } from "./routers/exports.js";
import { importsRouter } from "./routers/imports.js";
import { integrationsRouter } from "./routers/integrations.js";
import { multistateRouter } from "./routers/multistate.js";
import { servicePackagesRouter } from "./routers/servicePackages.js";
import {
  activityRouter,
  checklistsRouter,
  tasksRouter,
} from "./routers/tasks.js";
import { teamRouter } from "./routers/team.js";
import { uploadsRouter } from "./routers/uploads.js";

export const appRouter = router({
  auth: authRouter,
  clients: clientsRouter,
  deadlines: deadlinesRouter,
  servicePackages: servicePackagesRouter,
  tasks: tasksRouter,
  checklists: checklistsRouter,
  activity: activityRouter,
  announcements: announcementsRouter,
  notifications: notificationsRouter,
  emails: emailsRouter,
  reminderTemplates: reminderTemplatesRouter,
  team: teamRouter,
  exports: exportsRouter,
  integrations: integrationsRouter,
  imports: importsRouter,
  uploads: uploadsRouter,
  aiInferences: aiInferencesRouter,
  multistate: multistateRouter,
});

export type AppRouter = typeof appRouter;
