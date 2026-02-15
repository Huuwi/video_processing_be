
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserController } from './user.controller';
import { GoogleAuthController } from '../auth/google-auth.controller';
import { UserService } from './user.service';
import { User, UserSchema } from './user.schema';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from '../auth/google.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [UserController, GoogleAuthController],
  providers: [UserService, JwtStrategy, GoogleStrategy],
  exports: [UserService],
})
export class UserModule {}
