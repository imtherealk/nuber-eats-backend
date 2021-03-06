import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from 'src/jwt/jwt.service';
import { MailService } from 'src/mail/mail.service';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { Verification } from './entities/verification.entity';
import { UsersService } from './users.service';

const mockRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  findOneOrFail: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn(() => 'token-string'),
  verify: jest.fn(),
});

const mockMailService = () => ({
  sendVerificationEmail: jest.fn(),
});

type MockRepository<T = any> = Partial<
  Record<keyof Repository<User>, jest.Mock>
>;
describe('UsersService', () => {
  let service: UsersService;
  let mailService: MailService;
  let jwtService: JwtService;
  let usersRepository: MockRepository<User>;
  let verificationRepository: MockRepository<Verification>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Verification),
          useValue: mockRepository(),
        },
        { provide: JwtService, useValue: mockJwtService() },
        { provide: MailService, useValue: mockMailService() },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    mailService = module.get<MailService>(MailService);
    jwtService = module.get<JwtService>(JwtService);
    usersRepository = module.get(getRepositoryToken(User));
    verificationRepository = module.get(getRepositoryToken(Verification));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAccount', () => {
    const createAccountArgs = {
      email: 'test@gmail.com',
      password: 'test',
      role: UserRole.Owner,
    };
    it('should fail if user already exists', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 1,
        email: 'mock@gmail.com',
      });
      const result = await service.createAccount(createAccountArgs);
      expect(result).toMatchObject({
        success: false,
        error: 'There already exists a user with that email',
      });
    });
    it('should create a new user', async () => {
      const verification = { code: 'some-code' };
      usersRepository.findOne.mockResolvedValue(undefined);
      usersRepository.create.mockReturnValue(createAccountArgs);
      usersRepository.save.mockResolvedValue(createAccountArgs);
      verificationRepository.create.mockReturnValue({
        user: createAccountArgs,
      });
      verificationRepository.save.mockResolvedValue(verification);

      const result = await service.createAccount(createAccountArgs);

      expect(usersRepository.create).toHaveBeenCalledTimes(1);
      expect(usersRepository.create).toHaveBeenCalledWith(createAccountArgs);

      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.save).toHaveBeenCalledWith(createAccountArgs);

      expect(verificationRepository.create).toHaveBeenCalledTimes(1);
      expect(verificationRepository.create).toHaveBeenCalledWith({
        user: createAccountArgs,
      });

      expect(verificationRepository.save).toHaveBeenCalledTimes(1);
      expect(verificationRepository.save).toHaveBeenCalledWith({
        user: createAccountArgs,
      });

      expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        createAccountArgs.email,
        verification.code,
      );
      expect(result).toEqual({ success: true });
    });
    it('should fail on exception', async () => {
      usersRepository.findOne.mockRejectedValue(new Error());
      const result = await service.createAccount(createAccountArgs);
      expect(result).toEqual({
        success: false,
        error: "Couldn't create account",
      });
    });
  });

  describe('login', () => {
    const loginArgs = {
      email: 'test@nnn.com',
      password: 'testpassword',
    };
    it("should fail if user doesn't exist", async () => {
      usersRepository.findOne.mockResolvedValue(undefined);
      const result = await service.login(loginArgs);
      expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOne).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
      );
      expect(result).toEqual({ success: false, error: 'User Not Found' });
    });
    it('should fail if password is wrong', async () => {
      const mockedUser = {
        checkPassword: jest.fn(() => Promise.resolve(false)),
      };
      usersRepository.findOne.mockResolvedValue(mockedUser);

      const result = await service.login(loginArgs);
      expect(result).toEqual({ success: false, error: 'Wrong Password' });
    });
    it('should return a token if password is correct', async () => {
      const mockedUser = {
        id: 1,
        checkPassword: jest.fn(() => Promise.resolve(true)),
      };
      usersRepository.findOne.mockResolvedValue(mockedUser);

      const result = await service.login(loginArgs);

      expect(jwtService.sign).toHaveBeenCalledTimes(1);
      expect(jwtService.sign).toHaveBeenCalledWith(expect.any(Number));
      expect(result).toEqual({ success: true, token: 'token-string' });
    });
    it('should fail on exception', async () => {
      usersRepository.findOne.mockRejectedValue(new Error());
      const result = await service.login(loginArgs);
      expect(result).toEqual({
        success: false,
        error: 'Login failed for user test@nnn.com',
      });
    });
  });
  describe('findByID', () => {
    const findByIdArgs = {
      id: 1,
    };
    it('should fail if user is not found', async () => {
      usersRepository.findOneOrFail.mockRejectedValue(new Error());
      const result = await service.findById(1);

      expect(usersRepository.findOneOrFail).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOneOrFail).toHaveBeenCalledWith(findByIdArgs);
      expect(result).toEqual({ success: false, error: 'User Not Found' });
    });
    it('should return user if exists', async () => {
      usersRepository.findOneOrFail.mockResolvedValue(findByIdArgs);
      const result = await service.findById(1);

      expect(usersRepository.findOneOrFail).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOneOrFail).toHaveBeenCalledWith(findByIdArgs);
      expect(result).toEqual({ success: true, user: findByIdArgs });
    });
  });
  describe('editProfile', () => {
    const oldUserEmail = {
      email: 'old-email@nnnnn.com',
      verified: true,
    };
    const editEmailArgs = {
      userId: 1,
      input: { email: 'new-email@nnnnn.com' },
    };
    const oldUserPassword = {
      password: 'old-password',
    };
    const editPasswordArgs = {
      userId: 1,
      input: { password: 'new-password' },
    };

    it('should change email', async () => {
      const newVerification = {
        code: 'some-code',
      };
      const newUser = {
        verified: false,
        email: editEmailArgs.input.email,
      };
      usersRepository.findOne.mockResolvedValueOnce(oldUserEmail);
      usersRepository.findOne.mockResolvedValueOnce(undefined);
      verificationRepository.create.mockReturnValue(newVerification);
      verificationRepository.save.mockResolvedValue(newVerification);

      const result = await service.editProfile(
        editEmailArgs.userId,
        editEmailArgs.input,
      );

      expect(usersRepository.findOne).toHaveBeenCalledTimes(2);
      expect(usersRepository.findOne.mock.calls).toEqual([
        [editEmailArgs.userId],
        [{ email: editEmailArgs.input.email }],
      ]);

      expect(verificationRepository.create).toHaveBeenCalledTimes(1);
      expect(verificationRepository.create).toHaveBeenCalledWith({
        user: newUser,
      });

      expect(verificationRepository.save).toHaveBeenCalledTimes(1);
      expect(verificationRepository.save).toHaveBeenCalledWith(newVerification);

      expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        newUser.email,
        newVerification.code,
      );

      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual({ success: true });
    });
    it('should fail if email is alreadly in use', async () => {
      usersRepository.findOne.mockResolvedValueOnce(oldUserEmail);
      usersRepository.findOne.mockResolvedValueOnce({
        email: editEmailArgs.input.email,
      });

      const result = await service.editProfile(
        editEmailArgs.userId,
        editEmailArgs.input,
      );
      expect(usersRepository.findOne).toHaveBeenCalledTimes(2);
      expect(usersRepository.findOne.mock.calls).toEqual([
        [editEmailArgs.userId],
        [{ email: editEmailArgs.input.email }],
      ]);
      expect(result).toEqual({
        success: false,
        error: 'Email already in use',
      });
    });

    it('should change password', async () => {
      const newUser = {
        password: editPasswordArgs.input.password,
      };
      usersRepository.findOne.mockResolvedValue(oldUserPassword);

      const result = await service.editProfile(
        editPasswordArgs.userId,
        editPasswordArgs.input,
      );
      expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOne).toHaveBeenCalledWith(
        editPasswordArgs.userId,
      );
      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual({ success: true });
    });
    it('should fail on exception', async () => {
      usersRepository.findOne.mockRejectedValue(new Error());
      const result = await service.editProfile(1, { email: 'jj' });
      expect(result).toEqual({
        success: false,
        error: "Couldn't update profile",
      });
    });
  });
  describe('verifyEmail', () => {
    it('should verify email', async () => {
      const mockedVerification = {
        id: 1,
        user: { verified: false },
      };
      verificationRepository.findOne.mockResolvedValue(mockedVerification);

      const result = await service.verifyEmail('code');
      expect(verificationRepository.findOne).toHaveBeenCalledTimes(1);
      expect(verificationRepository.findOne).toHaveBeenCalledWith(
        { code: 'code' },
        { relations: ['user'] },
      );
      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.save).toHaveBeenCalledWith({ verified: true });

      expect(verificationRepository.delete).toHaveBeenCalledTimes(1);
      expect(verificationRepository.delete).toHaveBeenCalledWith(
        mockedVerification.id,
      );

      expect(result).toEqual({ success: true });
    });
    it('should fail if validation is not found', async () => {
      verificationRepository.findOne.mockResolvedValue(undefined);
      const result = await service.verifyEmail('code');
      expect(verificationRepository.findOne).toHaveBeenCalledTimes(1);
      expect(verificationRepository.findOne).toHaveBeenCalledWith(
        { code: 'code' },
        { relations: ['user'] },
      );
      expect(result).toEqual({
        success: false,
        error: 'Verification Not Found',
      });
    });
    it('should fail on exception', async () => {
      verificationRepository.findOne.mockRejectedValue(new Error());
      const result = await service.verifyEmail('code');
      expect(verificationRepository.findOne).toHaveBeenCalledTimes(1);
      expect(verificationRepository.findOne).toHaveBeenCalledWith(
        { code: 'code' },
        { relations: ['user'] },
      );
      expect(result).toEqual({ success: false, error: 'Verification failed' });
    });
  });
});
