import { addDays, addWeeks, addMonths, addYears, parseISO, format, isAfter, getDay } from "date-fns";
import type { Task, RecurrenceRule } from "@/types/index";

/**
 * Calculates the next due date for a recurring task.
 * Returns the date as a string in YYYY-MM-DD format, or null if the recurrence has ended.
 */
export function getNextDueDate(task: Task): string | null {
  if (!task.recurrence || !task.dueDate) return null;

  const { frequency, interval, daysOfWeek, endDate, endAfterOccurrences } = task.recurrence;
  const currentDueDate = parseISO(task.dueDate);
  let nextDueDate: Date;

  switch (frequency) {
    case "daily":
      nextDueDate = addDays(currentDueDate, interval);
      break;
    case "weekly":
      if (daysOfWeek && daysOfWeek.length > 0) {
        // Find the next matching day in daysOfWeek after current date
        let candidate = addDays(currentDueDate, 1);
        // Limit search to avoid infinite loop (e.g., check up to 8 weeks if interval is large)
        const maxSearchDays = 366; 
        let daysSearched = 0;
        
        while (!daysOfWeek.includes(getDay(candidate)) && daysSearched < maxSearchDays) {
          candidate = addDays(candidate, 1);
          daysSearched++;
        }
        nextDueDate = candidate;
      } else {
        nextDueDate = addWeeks(currentDueDate, interval);
      }
      break;
    case "monthly":
      nextDueDate = addMonths(currentDueDate, interval);
      break;
    case "yearly":
      nextDueDate = addYears(currentDueDate, interval);
      break;
    default:
      return null;
  }

  const nextDateStr = format(nextDueDate, "yyyy-MM-dd");

  // Check termination conditions
  if (endDate && isAfter(nextDueDate, parseISO(endDate))) {
    return null;
  }

  // If endAfterOccurrences is 1, it means this was the last occurrence.
  if (endAfterOccurrences !== undefined && endAfterOccurrences <= 1) {
    return null;
  }

  return nextDateStr;
}

/**
 * Returns a new partial Task object for the next occurrence of a recurring task.
 */
export function generateNextRecurringInstance(task: Task): Partial<Task> {
  const nextDueDate = getNextDueDate(task);
  if (!nextDueDate) return {};

  const nextRecurrence: RecurrenceRule | undefined = task.recurrence
    ? {
        ...task.recurrence,
        endAfterOccurrences: task.recurrence.endAfterOccurrences !== undefined
          ? task.recurrence.endAfterOccurrences - 1
          : undefined,
      }
    : undefined;

  return {
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    tags: [...task.tags],
    sectionId: task.sectionId,
    projectId: task.projectId,
    recurrence: nextRecurrence,
    sourceDocumentId: task.sourceDocumentId,
    dueDate: nextDueDate,
    status: "todo",
    rolledOver: false,
    subtaskIds: [], // Subtasks are not typically carried over to next recurrence
  };
}
