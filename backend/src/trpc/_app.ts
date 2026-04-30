import { router } from "./init.js";
import { aiRouter } from "./routers/ai.js";
import { aiInferencesRouter } from "./routers/aiInferences.js";
import { filesFromClientsRouter } from "./routers/digest-sms.js";
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
import { todoItemsRouter } from "./routers/todoItems.js";
import { modeFHealthRouter } from "./routers/modeFHealth.js";
import { taskMilestonesRouter } from "./routers/taskMilestones.js";
import { inboundRepliesRouter } from "./routers/inboundReplies.js";
import { deliveryEventsRouter } from "./routers/deliveryEvents.js";
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
  ai: aiRouter,
  aiInferences: aiInferencesRouter,
  filesFromClients: filesFromClientsRouter,
  multistate: multistateRouter,
  // v0.7 amendment surfaces (Phase 1 backend connection):
  //   todoItems  → ActionQueue (Today) computed view per PRD §4.8
  //   modeFHealth → State Monitoring Health module per IA §3.9d
  todoItems: todoItemsRouter,
  modeFHealth: modeFHealthRouter,
  // v0.8 amendment Phase 2 backend (P0 follow-ups landing today):
  //   taskMilestones  → mini-timeline data (PRD §9.4.1)
  //   inboundReplies  → cross-client Mail Inbox + Task detail conversation surface (§5.8)
  //   deliveryEvents  → Mail Issues tab + bounce surfacing (§5.8)
  taskMilestones: taskMilestonesRouter,
  inboundReplies: inboundRepliesRouter,
  deliveryEvents: deliveryEventsRouter,
});

export type AppRouter = typeof appRouter;
