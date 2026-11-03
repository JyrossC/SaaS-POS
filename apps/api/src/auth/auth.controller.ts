import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, RequestWithUser } from './auth.guard';
import { ApiJoiBody } from '../common/openapi/joi-body.decorator';
import { ApiResponseSchema } from '../common/openapi/response-schema.decorator';
import {
  authenticationResponseSchema,
  emailVerificationResponseSchema,
  forgotPasswordResponseSchema,
  logoutResponseSchema,
  mfaDisabledResponseSchema,
  mfaRecoveryCodesResponseSchema,
  mfaSetupResponseSchema,
  tenantRegistrationResponseSchema,
} from '../common/openapi/response-schemas';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  acceptInvitationSchema,
  emailSchema,
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  mfaCodeSchema,
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
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard)
  getCurrentUser(@Req() request: RequestWithUser) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    return request.user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiJoiBody(loginSchema)
  @ApiResponseSchema(HttpStatus.OK, authenticationResponseSchema)
  @UsePipes(new JoiValidationPipe(loginSchema))
  async login(
    @Body() body: LoginRequest,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.authService.login(body);
      this.setRefreshCookie(response, result.refreshToken, 'tenant');
      return { accessToken: result.accessToken, user: result.user };
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
  @ApiJoiBody(registerTenantSchema)
  @ApiResponseSchema(HttpStatus.CREATED, tenantRegistrationResponseSchema)
  @UsePipes(new JoiValidationPipe(registerTenantSchema))
  async register(@Body() body: RegisterTenantRequest) {
    return this.authService.registerTenant(body);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiJoiBody(acceptInvitationSchema)
  @UsePipes(new JoiValidationPipe(acceptInvitationSchema))
  async acceptInvitation(@Body() body: AcceptInvitationRequest) {
    return this.authService.acceptInvitation(body);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiJoiBody(emailVerificationSchema)
  @ApiResponseSchema(HttpStatus.OK, emailVerificationResponseSchema)
  @UsePipes(new JoiValidationPipe(emailVerificationSchema))
  async verifyEmail(@Body() body: { token: string }) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('email/verification/resend')
  @HttpCode(HttpStatus.OK)
  @ApiJoiBody(emailSchema)
  @ApiResponseSchema(HttpStatus.OK, forgotPasswordResponseSchema)
  @UsePipes(new JoiValidationPipe(emailSchema))
  async resendEmailVerification(@Body() body: { email: string }) {
    return this.authService.resendEmailVerification(body.email);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiResponseSchema(HttpStatus.OK, authenticationResponseSchema)
  async refresh(
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request.headers.origin);
    const refreshToken = this.readCookie(request.headers.cookie, 'spos_tenant_refresh');
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh session is invalid or expired.');
    }
    const result = await this.authService.refreshUserSession(refreshToken);
    this.setRefreshCookie(response, result.refreshToken, 'tenant');
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard)
  @ApiResponseSchema(HttpStatus.OK, mfaSetupResponseSchema)
  async setupMfa(@Req() request: RequestWithUser) {
    if (!request.user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.authService.setupUserMfa(request.user.id);
  }

  @Post('mfa/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard)
  @ApiJoiBody(mfaCodeSchema)
  @ApiResponseSchema(HttpStatus.OK, mfaRecoveryCodesResponseSchema)
  @UsePipes(new JoiValidationPipe(mfaCodeSchema))
  async confirmMfa(@Req() request: RequestWithUser, @Body() body: { code: string }) {
    if (!request.user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.authService.confirmUserMfa(request.user.id, body.code);
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard)
  @ApiJoiBody(mfaCodeSchema)
  @ApiResponseSchema(HttpStatus.OK, mfaDisabledResponseSchema)
  @UsePipes(new JoiValidationPipe(mfaCodeSchema))
  async disableMfa(@Req() request: RequestWithUser, @Body() body: { code: string }) {
    if (!request.user) throw new UnauthorizedException('Authenticated user context is required.');
    await this.authService.disableUserMfa(request.user.id, body.code);
    return { disabled: true };
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiJoiBody(forgotPasswordSchema)
  @ApiResponseSchema(HttpStatus.OK, forgotPasswordResponseSchema)
  @UsePipes(new JoiValidationPipe(forgotPasswordSchema))
  async forgotPassword(@Body() body: ForgotPasswordRequest) {
    return this.authService.forgotPassword(body);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiJoiBody(resetPasswordSchema)
  @UsePipes(new JoiValidationPipe(resetPasswordSchema))
  async resetPassword(@Body() body: ResetPasswordRequest) {
    return this.authService.resetPassword(body);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiResponseSchema(HttpStatus.OK, logoutResponseSchema)
  @UseGuards(AuthGuard)
  async logout(
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    if (request.authSessionId) {
      await this.authService.revokeSession(request.authSessionId, request.user.id);
    }
    this.clearRefreshCookie(response, 'tenant');
    return { loggedOut: true };
  }

  private setRefreshCookie(response: Response, token: string, audience: 'tenant' | 'platform') {
    response.cookie(audience === 'tenant' ? 'spos_tenant_refresh' : 'spos_platform_refresh', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: audience === 'tenant' ? '/api/v1/auth' : '/api/v1/platform/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(response: Response, audience: 'tenant' | 'platform') {
    response.clearCookie(
      audience === 'tenant' ? 'spos_tenant_refresh' : 'spos_platform_refresh',
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: audience === 'tenant' ? '/api/v1/auth' : '/api/v1/platform/auth',
      },
    );
  }

  private readCookie(header: string | undefined, name: string): string | undefined {
    const cookie = header?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    if (!cookie) return undefined;
    try {
      return decodeURIComponent(cookie.slice(name.length + 1));
    } catch {
      return undefined;
    }
  }

  private assertTrustedOrigin(origin: string | undefined): void {
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException('An allowed request origin is required.');
      }
      return;
    }
    const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((item) => item.trim());
    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
  }
}
