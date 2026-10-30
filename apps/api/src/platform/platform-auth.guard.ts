import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformAuthService } from './platform-auth.service';
import { RequestWithPlatformAdmin } from './platform.types';

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPlatformAdmin>();
    const authorization = request.headers.authorization;

    if (!authorization || typeof authorization !== 'string') {
      throw new UnauthorizedException('Missing platform authentication token.');
    }

    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!match) {
      throw new UnauthorizedException('Malformed platform authentication token.');
    }

    const adminId = this.platformAuthService.verifyToken(match[1]);
    request.platformAdmin = await this.platformAuthService.resolvePrincipal(adminId);
    return true;
  }
}
