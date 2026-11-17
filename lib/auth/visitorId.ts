// Shared by proxy.ts and the server-side helpers. Pure constants, so it is safe to import anywhere.
export const VISITOR_COOKIE = "orbit_uid";
export const VISITOR_ID = /^demo_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Local development (no proxy-issued cookie) keeps using the original demo user, so existing dev data still shows up.
export const DEV_USER_ID = "user_demo_123";
