export const MULTIPROFESSIONAL_ROLES = ["psychologist", "social_worker"] as const;
export const MANAGEMENT_ROLES = ["director", "coordinator"] as const;

export function canOperateSchedule(role: string) {
  return MULTIPROFESSIONAL_ROLES.includes(role as (typeof MULTIPROFESSIONAL_ROLES)[number]);
}

export function canDecideCancellation(role: string) {
  return MANAGEMENT_ROLES.includes(role as (typeof MANAGEMENT_ROLES)[number]);
}

export const appointmentStatusLabels: Record<string, string> = {
  scheduled: "Agendado",
  cancellation_requested: "Cancelamento solicitado",
  cancelled: "Cancelado — aprovado pela gestão",
  absent: "Não compareceu",
  completed: "Atendimento realizado",
};

export const appointmentTypeLabels: Record<string, string> = {
  initial: "Primeiro atendimento",
  return: "Retorno",
};
