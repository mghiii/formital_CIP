import { NextResponse, type NextRequest } from "next/server";

function firstHeaderValue(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function isInternalHost(host: string): boolean {
  const hostname = host.replace(/^\[/, "").replace(/\]$/, "").split(":")[0]?.toLowerCase() ?? "";
  return !hostname || hostname === "0.0.0.0" || hostname === "::";
}

function configuredAppOrigin(): string {
  const configured = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    ""
  ).trim();

  if (!configured) {
    return "";
  }

  try {
    const url = new URL(configured);
    return isInternalHost(url.host) ? "" : url.origin;
  } catch {
    return "";
  }
}

export function safeAppPath(path: string, fallback = "/login"): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /^\/[a-z][a-z0-9+.-]*:/i.test(path)) {
    return fallback;
  }

  return path;
}

export function getPublicRequestOrigin(request: NextRequest): string {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost || firstHeaderValue(request.headers.get("host"));

  if (host && !isInternalHost(host)) {
    return `${forwardedProto || request.nextUrl.protocol.replace(":", "") || "https"}://${host}`;
  }

  const configuredOrigin = configuredAppOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (request.nextUrl.host && !isInternalHost(request.nextUrl.host)) {
    return request.nextUrl.origin;
  }

  return "http://localhost:3000";
}

export function toAppUrl(request: NextRequest, path: string): URL {
  return new URL(safeAppPath(path), getPublicRequestOrigin(request));
}

export function getSafeReturnPath(request: NextRequest, fallback: string): string {
  const referer = request.headers.get("referer");
  if (!referer) {
    return safeAppPath(fallback);
  }

  try {
    const url = new URL(referer, getPublicRequestOrigin(request));
    return safeAppPath(url.pathname, fallback);
  } catch {
    return safeAppPath(fallback);
  }
}

export function redirectToAppPath(request: NextRequest, path: string, status = 307): NextResponse {
  const response = NextResponse.redirect(toAppUrl(request, path), { status });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
