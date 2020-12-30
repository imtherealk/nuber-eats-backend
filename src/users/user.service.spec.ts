import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from 'src/jwt/jwt.service';
import { MailService } from 'src/mail/mail.service';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Verification } from './entities/verification.entity';
import { UsersService } from './users.service';

const mockRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
});

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockMailService = {
  sendVerificationEmail: jest.fn(),
};
type MockRepository<T = any> = Partial<
  Record<keyof Repository<User>, jest.Mock>
>;
describe('UsersService', () => {
  let service: UsersService;
  let mailService: MailService;
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
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    mailService = module.get<MailService>(MailService);
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
      role: 0,
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
      usersRepository.findOne.mockResolvedValue(undefined);
      usersRepository.create.mockReturnValue(createAccountArgs);
      usersRepository.save.mockResolvedValue(createAccountArgs);
      verificationRepository.create.mockReturnValue({
        user: createAccountArgs,
      });
      verificationRepository.save.mockResolvedValue({ code: 'some-code' });

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
        expect.any(String),
        expect.any(String),
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

    // const mockUser = {
    //   email: 'test@gmail.com',
    //   password: '$2b$10$XBE0xxxxxxxxGGGGGGGGGGGGhhhhhhhhhzzzzzzzzzzzzzzzwwwww',
    //   role: 0,
    //   id: 1,
    //   created_at: '2020-12-30T03:54:57.146Z',
    //   updated_at: '2020-12-30T03:54:57.146Z',
    //   verified: false,
    // };
    // const mockVerification = {
    //   code: 'code-xxxx-xxxx-xxxx',
    //   id: 1,
    //   user: mockUser,
    // };
    // it('should create a new user - commented)', async () => {
    //   usersRepository.findOne.mockResolvedValue(undefined);
    //   usersRepository.create.mockReturnValue(mockUser);
    //   usersRepository.save.mockResolvedValue(mockUser);
    //   verificationRepository.create.mockReturnValue(mockVerification);
    //   verificationRepository.save.mockResolvedValue(mockVerification);
    //   const result = await service.createAccount(createAccountArgs);
    //   expect(usersRepository.create).toHaveBeenCalledTimes(1);
    //   expect(usersRepository.create).toHaveBeenCalledWith(createAccountArgs);
    //   expect(usersRepository.save).toHaveBeenCalledTimes(1);
    //   expect(usersRepository.save).toHaveBeenCalledWith(mockUser);
    //   expect(verificationRepository.create).toHaveBeenCalledTimes(1);
    //   expect(verificationRepository.create).toHaveBeenCalledWith({
    //     user: mockUser,
    //   });
    //   expect(verificationRepository.save).toHaveBeenCalledTimes(1);
    //   expect(verificationRepository.save).toHaveBeenCalledWith(
    //     mockVerification,
    //   );
    //   expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    //   expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
    //     expect.any(String),
    //     expect.any(String),
    //   );
    //   expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
    //     mockUser.email,
    //     mockVerification.code,
    //   );
    //   expect(result).toEqual({ success: true });
    // });
  });

  it.todo('login');
  it.todo('editProfile');
  it.todo('findById');
  it.todo('verifyEmail');
});
