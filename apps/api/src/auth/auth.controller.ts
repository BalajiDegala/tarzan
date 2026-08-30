import type { AuthSession, AuthUser } from '@tarzan/types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const result = await this.authService.register(dto);
    this.setAuthCookie(response, result.token);

    return this.authService.toSession(result.user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const result = await this.authService.login(dto);
    this.setAuthCookie(response, result.token);

    return this.authService.toSession(result.user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user.id);
    response.clearCookie(AUTH_COOKIE_NAME, this.baseCookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): AuthSession {
    return this.authService.toSession(user);
  }

  private setAuthCookie(response: Response, token: string): void {
    response.cookie(AUTH_COOKIE_NAME, token, {
      ...this.baseCookieOptions(),
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
    });
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: this.configService.get<boolean>('COOKIE_SECURE') ?? false,
    };
  }
}
