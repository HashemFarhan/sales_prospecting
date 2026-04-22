export const AUTH_COOKIE_NAME = "tempus-auth-session";
export const AUTH_SESSION_VALUE = "tempus-authenticated-v1";

const AUTH_USERNAME = "tmp_admin";
const AUTH_PASSWORD = "Rewd234@d23";

export function isValidLogin(username: string, password: string) {
  return username === AUTH_USERNAME && password === AUTH_PASSWORD;
}

export function isAuthenticatedSession(sessionValue?: string) {
  return sessionValue === AUTH_SESSION_VALUE;
}
