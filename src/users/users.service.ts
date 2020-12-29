import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from 'src/jwt/jwt.service';
import { Repository } from 'typeorm';
import {
  CreateAccountInput,
  CreateAccountOutput,
} from './dtos/create-account.dto';
import { EditProfileInput, EditProfileOutput } from './dtos/edit-profile.dto';
import { LoginInput, LoginOutput } from './dtos/login.dto';
import { UserProfileOutput } from './dtos/user-profile.dto';
import { VerifyEmailOutput } from './dtos/verify-email.dto';
import { User } from './entities/user.entity';
import { Verification } from './entities/verification.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Verification)
    private readonly verifications: Repository<Verification>,
    private readonly jwtService: JwtService,
  ) {}

  async createAccount({
    email,
    password,
    role,
  }: CreateAccountInput): Promise<CreateAccountOutput> {
    try {
      const exists = await this.users.findOne({ email });
      if (exists) {
        return {
          success: false,
          error: 'There is a user with that email already',
        };
      }
      const user = await this.users.save(
        this.users.create({ email, password, role }),
      );
      await this.verifications.save(this.verifications.create({ user }));
      return { success: true };
    } catch (error) {
      return { success: false, error: "Couldn't create account" };
    }
  }

  async login({ email, password }: LoginInput): Promise<LoginOutput> {
    try {
      const user = await this.users.findOne(
        { email },
        { select: ['id', 'password'] },
      );
      if (!user) {
        return { success: false, error: 'User Not Found' };
      }
      const passwordCorrect = await user.checkPassword(password);

      if (!passwordCorrect) {
        return { success: false, error: 'Wrong Password' };
      }
      const token = this.jwtService.sign(user.id);
      return { success: true, token };
    } catch (error) {
      return { success: false, error };
    }
  }
  async findById(id: number): Promise<UserProfileOutput> {
    try {
      const user = await this.users.findOne({ id });
      if (user) {
        return { success: true, user };
      }
      throw Error();
    } catch (error) {
      return { success: false, error: 'User Not Found' };
    }
  }
  async editProfile(
    userId: number,
    { email, password }: EditProfileInput,
  ): Promise<EditProfileOutput> {
    try {
      const user = await this.users.findOne(userId);

      if (email) {
        user.email = email;
        user.verified = false;

        await this.verifications.save(this.verifications.create({ user }));
      }
      if (password) {
        user.password = password;
      }
      await this.users.save(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Couldn't update profile" };
    }
  }

  async verifyEmail(code: string): Promise<VerifyEmailOutput> {
    try {
      const verification = await this.verifications.findOne(
        { code },
        { relations: ['user'] },
      );
      if (verification) {
        verification.user.verified = true;
        await this.users.save(verification.user);
        await this.verifications.delete(verification.id);
        return {
          success: true,
        };
      }
      return { success: false, error: 'Verification Not Found' };
    } catch (error) {
      return { success: false, error };
    }
  }
}
