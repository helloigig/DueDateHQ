/**
 * Wireframe-grade simulator for the Method A inbound flow (PRD §5.7 Stage 3).
 * Picks a `requested_waiting` (or `not_requested`) item on the task, runs
 * inbound-classifier classify + AI-flagged anomaly check, dispatches `receiveDocument`.
 */
import { actions, getState } from "../data/store";
import { classifyDocument, flagAnomaly } from "./ai-stub";

export async function simulateInboundDocument(
  taskId: string,
  clientName: string
): Promise<void> {
  const { checklistItems, importedFacts, tasks } = getState();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  const candidates = checklistItems.filter(
    (c) =>
      c.taskId === taskId &&
      (c.state === "requested_waiting" || c.state === "not_requested")
  );
  if (candidates.length === 0) {
    alert(
      `${clientName} has no waiting checklist items on this task. Try "Send reminder now" first.`
    );
    return;
  }
  const item = candidates[0];
  const filename = `${item.itemType}-${Date.now().toString(36)}.pdf`;

  const classified = await classifyDocument({
    filename,
    itemType: item.itemType,
  });

  const priorValues = importedFacts
    .filter((f) => f.clientId === task.clientId && f.itemType === item.itemType)
    .map((f) => f.observedAmount)
    .filter((v): v is number => typeof v === "number");
  // Simulate a current-year value 30% lower than prior to trigger a flag.
  const simulatedValue =
    priorValues.length > 0 ? Math.round(priorValues[0] * 0.67) : 0;
  const anomaly = flagAnomaly(simulatedValue, priorValues);

  actions.receiveDocument(item.id, {
    filename,
    aiClassification: classified.guess,
    aiConfidence: classified.confidence,
    flagReason: anomaly.flag ? anomaly.reason : undefined,
    flagSeverity: anomaly.severity,
  });
}
