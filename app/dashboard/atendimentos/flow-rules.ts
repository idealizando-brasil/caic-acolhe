export const ATTENDANCE_ROLES = ["psychologist", "social_worker"] as const;

export function canRegisterAttendance(role: string) {
  return ATTENDANCE_ROLES.includes(role as (typeof ATTENDANCE_ROLES)[number]);
}

export const continuityOptions = {
  conclude: "Concluir acompanhamento",
  return_scheduled: "Necessita retorno — agendar agora",
  return_pending: "Necessita retorno — data a definir",
} as const;

export type ContinuityOption = keyof typeof continuityOptions;
