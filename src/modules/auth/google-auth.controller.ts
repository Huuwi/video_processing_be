
import { Controller, Get, UseGuards, Request, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from '../user/user.service';

@Controller('oauth2Callback')
export class GoogleAuthController {
  constructor(private readonly userService: UserService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req, @Res() res) {
    // Handles the callback from Google
    // req.user is already validated by GoogleStrategy and contains { access_token, user }
    const { access_token } = req.user;
    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}/oauth/callback?token=${access_token}`);
  }
}
