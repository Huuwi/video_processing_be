
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async register(createUserDto: any): Promise<User> {
    const { username, password, mail, phone, nickname } = createUserDto;

    // Check if user exists
    const existingUser = await this.userModel.findOne({ $or: [{ username }, { mail }] });
    if (existingUser) {
      throw new ConflictException('Username or Mail already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new this.userModel({
      username,
      password: hashedPassword,
      mail,
      phone,
      nickname,
      balance: 0, // Default balance
      remaining_time_ms: 180000,
      vip: false,
    });

    return newUser.save();
  }

  async login(loginDto: any): Promise<{ access_token: string; user: any }> {
    const { username, password } = loginDto;
    const user = await this.userModel.findOne({ username });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    console.log(user);
    

    const payload = { username: user.username, sub: user._id, mail: user.mail };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        username: user.username,
        nickname: user.nickname,
        mail: user.mail,
        phone: user.phone,
        balance: user.balance,
        remaining_time_ms: user.remaining_time_ms,
        vip: user.vip,
        avatar: user.avatar
      }
    };
  }

  async validateUser(payload: any): Promise<any> {
    return this.userModel.findById(payload.sub);
  }

  async getUserInfo(userId: string): Promise<any> {
      const user = await this.userModel.findById(userId); // Exclude password
      if (!user) throw new UnauthorizedException('User not found');
      return {
          _id: user._id,
          username: user.username,
          nickname: user.nickname,
          mail: user.mail,
          phone: user.phone,
          balance: user.balance,
          remaining_time_ms: user.remaining_time_ms,
          vip: user.vip,
          avatar: user.avatar
      };
  }

  async validateGoogleUser(googleUser: any): Promise<any> {
    const { email, firstName, lastName, accessToken } = googleUser;
    
    // Check if user exists by email
    let user = await this.userModel.findOne({ mail: email });
    
    if (!user) {
      // Create new user if not exists
      // Use email as username, random password
      const salt = await bcrypt.genSalt(10);
      const randomPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);
      
      const newUser = new this.userModel({
        username: email, // Use email as username
        password: hashedPassword,
        mail: email,
        nickname: `${firstName} ${lastName}`,
        balance: 0,
        remaining_time_ms: 180000, // 3 minutes free
        vip: false,
        phone: '', // Optional
        avatar: googleUser.picture,
        googleAccessToken: googleUser.accessToken
      });
      user = await newUser.save();
    } else {
        // Update access token if user exists
        user.googleAccessToken = googleUser.accessToken;
        user.avatar = googleUser.picture; // Also update avatar
        await user.save();
    }
    
    // Generate JWT token
    const payload = { username: user.username, sub: user._id, mail: user.mail };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        username: user.username,
        nickname: user.nickname,
        mail: user.mail,
        phone: user.phone,
        balance: user.balance,
        remaining_time_ms: user.remaining_time_ms,
        vip: user.vip,
        avatar: user.avatar
      }
    };
  }

  async revokeGoogleToken(userId: string) {
    const user = await this.userModel.findById(userId);
    if (user && user.googleAccessToken) {
        try {
            // Revoke token via Google API
            await fetch(`https://oauth2.googleapis.com/revoke?token=${user.googleAccessToken}`, {
                method: 'POST',
                headers: { 'Content-type': 'application/x-www-form-urlencoded' }
            });
            
            user.googleAccessToken = ''; // Clear token
            await user.save();
            return { message: 'Google token revoked' };
        } catch (error) {
            console.error('Failed to revoke Google token:', error);
            // Still clear from DB
            user.googleAccessToken = '';
            await user.save();
            return { message: 'Token cleared locally' };
        }
    }
    return { message: 'No token to revoke' };
  }
}
