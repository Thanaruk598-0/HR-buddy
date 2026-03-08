import { createHmac, timingSafeEqual } from 'crypto';

type AdminTokenPayload = {
  sub: 'admin';
  username: string;
  iat: number;
  exp: number;
};

export function issueAdminSessionToken(params: {
  username: string;
  secret: string;
  ttlMinutes: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + params.ttlMinutes * 60;

  const payload: AdminTokenPayload = {
    sub: 'admin',
    username: params.username,
    iat,
    exp,
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadEncoded, params.secret);

  return {
    sessionToken: `${payloadEncoded}.${signature}`,
    expiresAt: new Date(exp * 1000),
  };
}

export function verifyAdminSessionToken(params: {
  token: string;
  secret: string;
  now?: Date;
}) {
  const tokenParts = params.token.split('.');

  if (tokenParts.length !== 2) {
    return null;
  }

  const [payloadEncoded, signature] = tokenParts;
  const expectedSignature = sign(payloadEncoded, params.secret);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = parsePayload(payloadEncoded);

  if (!payload || payload.sub !== 'admin') {
    return null;
  }

  const now = params.now ?? new Date();
  const nowUnix = Math.floor(now.getTime() / 1000);

  if (payload.exp <= nowUnix) {
    return null;
  }

  return {
    username: payload.username,
    expiresAt: new Date(payload.exp * 1000),
  };
}

function sign(payloadEncoded: string, secret: string) {
  return createHmac('sha256', secret)
    .update(payloadEncoded)
    .digest('base64url');
}

function parsePayload(payloadEncoded: string): AdminTokenPayload | null {
  try {
    const payloadJson = base64UrlDecode(payloadEncoded);
    const payload = JSON.parse(payloadJson) as Partial<AdminTokenPayload>;

    if (
      payload?.sub !== 'admin' ||
      typeof payload.username !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload as AdminTokenPayload;
  } catch {
    return null;
  }
}

function base64UrlEncode(raw: string) {
  return Buffer.from(raw, 'utf8').toString('base64url');
}

function base64UrlDecode(raw: string) {
  return Buffer.from(raw, 'base64url').toString('utf8');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
