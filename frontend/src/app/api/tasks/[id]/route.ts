import { tasksDELETE, tasksGET_ONE, tasksPATCH } from "@/lib/api/tasks";

export const GET = tasksGET_ONE;
export const PATCH = tasksPATCH;
export const DELETE = tasksDELETE;
