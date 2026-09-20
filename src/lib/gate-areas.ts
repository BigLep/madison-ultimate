// The two password-gated areas (ADR 0008): ops tools at /admin, coach-facing tools at /coach.
// Each has its own secret and cookie; the gate mechanism itself is shared (password-gate.ts).

import { GateArea } from './password-gate';

export const ADMIN_GATE_AREA: GateArea = {
  name: 'admin',
  cookieName: 'madison_admin_auth',
  loginPath: '/admin/login',
  secretEnvVar: 'ADMIN_SECRET',
};

export const COACH_GATE_AREA: GateArea = {
  name: 'coach',
  cookieName: 'madison_coach_auth',
  loginPath: '/coach/login',
  secretEnvVar: 'COACH_TOOLS_PASSWORD',
};
