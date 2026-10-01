import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthResult {
  authorized: boolean;
  deviceId?: string;
  error?: string;
}

export function verifyBearerAuth(
  authHeader: string | undefined,
  deviceTokens: Record<string, string>
): AuthResult {
  if (!authHeader) {
    return { authorized: false, error: 'UNAUTHORIZED' };
  }

  // Must strictly start with case-sensitive 'Bearer '
  if (!authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'UNAUTHORIZED' };
  }

  // Extract token and trim leading/trailing whitespace
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { authorized: false, error: 'UNAUTHORIZED' };
  }

  // Compute SHA-256 hash of incoming token
  const incomingHashBuf = crypto.createHash('sha256').update(token).digest();

  // Compare against registered device token hashes in constant time
  for (const [deviceId, registeredHashHex] of Object.entries(deviceTokens)) {
    try {
      const registeredHashBuf = Buffer.from(registeredHashHex, 'hex');
      if (
        registeredHashBuf.length === incomingHashBuf.length &&
        crypto.timingSafeEqual(incomingHashBuf, registeredHashBuf)
      ) {
        return { authorized: true, deviceId };
      }
    } catch {
      // Ignore buffer length or hex decoding errors
    }
  }

  return { authorized: false, error: 'UNAUTHORIZED' };
}

declare module 'fastify' {
  interface FastifyRequest {
    deviceId?: string;
  }
}

export function createAuthPreHandler(deviceTokens: Record<string, string>) {
  return async function authenticateBearer(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const result = verifyBearerAuth(authHeader, deviceTokens);

    if (!result.authorized) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid or missing Bearer token'
      });
    }

    request.deviceId = result.deviceId;
  };
}
