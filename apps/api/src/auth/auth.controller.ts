import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard, RequestWithUser } from './auth.guard';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  acceptInvitationSchema,
  forgotPasswordSchema,
  loginSchema,
  registerTenantSchema,
  resetPasswordSchema,
} from '../common/validation/schemas';
import { AuthService } from './auth.service';
import {
  AcceptInvitationRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterTenantRequest,
  ResetPasswordRequest,
} from './auth.types';
import { LoggingService } from '../logging/logging.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  getCurrentUser(@Req() request: RequestWithUser) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    return request.user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new JoiValidationPipe(loginSchema))
  async login(@Body() body: LoginRequest, @Req() request: RequestWithUser) {
    try {
      return await this.authService.login(body);
    } catch (error) {
      this.loggingService.warn(
        `Login failed for ${body.email} on tenant ${body.tenantSlug}`,
        `${request.method} ${request.url}`,
      );
      throw error;
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new JoiValidationPipe(registerTenantSchema))
  async register(@Body() body: RegisterTenantRequest) {
    return this.authService.registerTenant(body);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new JoiValidationPipe(acceptInvitationSchema))
  async acceptInvitation(@Body() body: AcceptInvitationRequest) {
    return this.authService.acceptInvitation(body);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new JoiValidationPipe(forgotPasswordSchema))
  async forgotPassword(@Body() body: ForgotPasswordRequest) {
    return this.authService.forgotPassword(body);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new JoiValidationPipe(resetPasswordSchema))
  async resetPassword(@Body() body: ResetPasswordRequest) {
    return this.authService.resetPassword(body);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async logout(@Req() request: RequestWithUser) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    const authorization = request.headers.authorization;
    if (authorization && typeof authorization === 'string') {
      const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
      if (match) {
        await this.authService.revokeToken(match[1]);
      }
    }
    return { loggedOut: true };
  }
}
