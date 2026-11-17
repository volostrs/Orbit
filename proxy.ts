import { NextResponse, type NextRequest } from "next/server";
import { VISITOR_COOKIE, VISITOR_ID } from "@/lib/auth/visitorId";

// Public deployment: give every browser an anonymous, random visitor id so visitors never share notes.
// Not applied in local development, where the original demo user is used (see lib/auth/visitor.ts).
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  if (existing && VISITOR_ID.test(existing)) return NextResponse.next();

  const id = `demo_${crypto.randomUUID()}`;
  // Set it on the request too, so the very first render (and any action in it) already sees the new id.
  request.cookies.set(VISITOR_COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}

export const config = {
  // Pages, server actions and API routes; not static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
