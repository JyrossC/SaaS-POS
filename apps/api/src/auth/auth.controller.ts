import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UnauthorizedException, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard, RequestWithUser } from './auth.guard';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  acceptInvitationSchema,
  loginSchema,
  registerTenantSchema,
} from '../common/validation/schemas';
import { AuthService } from './auth.service';
import { AcceptInvitationRequest, LoginRequest, RegisterTenantRequest } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async login(@Body() body: LoginRequest) {
    return this.authService.login(body);
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
}
