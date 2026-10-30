import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;

    if (!authorization || typeof authorization !== 'string') {
      throw new UnauthorizedException('Missing authentication token.');
    }

    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!match) {
      throw new UnauthorizedException('Malformed authentication token.');
    }

    const token = match[1];

    // Verify signature and structure (synchronous)
    let payload: { sub: string; membershipId: string };
    try {
      const verified = this.authService.verifyTokenSilent(token);
      if (!verified) {
        throw new UnauthorizedException('Invalid or expired authentication token.');
      }
      payload = verified;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired authentication token.');
    }

    // Token revocation check (asynchronous)
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked. Please sign in again.');
    }

    request.user = await this.authService.resolvePrincipal(
      payload.sub,
      payload.membershipId,
    );
    return true;
  }
}
