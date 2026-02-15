
import { Controller, Post, Body, HttpException, HttpStatus, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // @Post('register')
  // async register(@Body() createUserDto: any) {
  //   try {
  //     return await this.userService.register(createUserDto);
  //   } catch (error) {
  //     throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @Post('login')
  // async login(@Body() loginDto: any) {
  //   try {
  //     return await this.userService.login(loginDto);
  //   } catch (error) {
  //     throw new HttpException(error.message, HttpStatus.UNAUTHORIZED);
  //   }
  // }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.userService.getUserInfo(req.user._id);
  }

  @Get('auth/google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() req) {
    // Initiates the Google OAuth2 login flow
  }

  @Post('auth/google/revoke')
  @UseGuards(JwtAuthGuard)
  async revokeGoogle(@Request() req) {
      return this.userService.revokeGoogleToken(req.user._id);
  }
}
