import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Verification } from 'src/users/entities/verification.entity';
import * as request from 'supertest';
import { getConnection, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';

jest.mock('got');

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  email: 'immda@naver.com',
  password: '12345',
};

describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let usersRepository: Repository<User>;
  let verificationRepository: Repository<Verification>;
  let jwtToken: string;

  const baseTest = () => request(app.getHttpServer()).post(GRAPHQL_ENDPOINT);
  const publicTest = (query: string) => baseTest().send({ query });
  const privateTest = (query: string, token: string = jwtToken) =>
    baseTest().set('x-jwt', token).send({ query });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    verificationRepository = module.get<Repository<Verification>>(
      getRepositoryToken(Verification),
    );
    await app.init();
  });

  afterAll(async () => {
    await getConnection().dropDatabase();
    app.close();
  });

  describe('createAccount', () => {
    it('should create account', () => {
      return publicTest(`
          mutation {
            createAccount(input:{
              email: "${testUser.email}",
              password: "${testUser.password}",
              role: Client
            }
            ){
              success
              error
            }
          }
        `)
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { createAccount },
            },
          } = res;
          expect(createAccount).toEqual({
            success: true,
            error: null,
          });
        });
    });
    it('should fail if account already exists', () => {
      return publicTest(`
          mutation {
            createAccount(input:{
              email: "${testUser.email}",
              password: "${testUser.password}",
              role: Client
            }
            ){
              success
              error
            }
          }
        `)
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { createAccount },
            },
          } = res;
          expect(createAccount).toEqual({
            success: false,
            error: expect.any(String),
          });
        });
    });
  });
  describe('login', () => {
    it('should login with correct credentials', () => {
      return publicTest(`
          mutation {
            login(input:{
              email: "${testUser.email}",
              password: "${testUser.password}",
            }
            ){
              success
              error
              token
            }
          }
        `)
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { login },
            },
          } = res;
          expect(login).toEqual({
            success: true,
            error: null,
            token: expect.any(String),
          });
          jwtToken = login.token;
        });
    });

    it('should not be able to login with wrong credentials.', () => {
      return publicTest(`
          mutation {
            login(input:{
              email: "${testUser.email}",
              password: "fail",
            }
            ){
              success
              error
              token
            }
          }
        `)
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { login },
            },
          } = res;
          expect(login).toEqual({
            success: false,
            error: 'Wrong Password',
            token: null,
          });
        });
    });
  });

  describe('userProfile', () => {
    let userId: number;

    beforeAll(async () => {
      const [user] = await usersRepository.find();
      userId = user.id;
    });

    it("should see a user's profile", () => {
      return privateTest(
        `
        {
          userProfile(userId: ${userId}){
            success
            error
            user{
              id
            }
          }
        }
      `,
      )
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { userProfile },
            },
          } = res;
          expect(userProfile).toEqual({
            success: true,
            error: null,
            user: { id: userId },
          });
        });
    });

    it('should fail if user not found', () => {
      return privateTest(
        `
        {
          userProfile(userId: 100){
            success
            error
            user{
              id
            }
          }
        }
      `,
      )
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { userProfile },
            },
          } = res;

          expect(userProfile).toEqual({
            success: false,
            error: 'User Not Found',
            user: null,
          });
        });
    });

    it('should fail if token is invalid', () => {
      return privateTest(
        `
        {
          userProfile(userId: ${userId}){
            success
            error
            user{
              id
            }
          }
        }
      `,
        'invalid-token',
      )
        .expect(200)
        .expect(res => {
          const {
            body: {
              errors: [{ message }],
            },
          } = res;
          expect(message).toEqual('jwt malformed');
        });
    });
  });

  describe('me', () => {
    it('should find my profile', () => {
      return privateTest(`{ me { email } }`)
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { me },
            },
          } = res;
          expect(me.email).toBe(testUser.email);
        });
    });

    it('should fail if token is invalid', () => {
      return privateTest(`{ me { email } }`, 'invalid-token')
        .expect(200)
        .expect(res => {
          const {
            body: {
              errors: [{ message }],
            },
          } = res;
          expect(message).toEqual('jwt malformed');
        });
    });
  });

  describe('editProfile', () => {
    const NEW_EMAIL = 'imtherealk@gmail.com';
    const NEW_PASSWORD = '54321';

    it('should change email', () => {
      return privateTest(
        `mutation {
            editProfile(input: {email: "${NEW_EMAIL}"}) {
              success
              error
            }
          }`,
      )
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { editProfile },
            },
          } = res;
          expect(editProfile).toEqual({
            success: true,
            error: null,
          });
        });
    });

    it('should have new email', () => {
      return privateTest(`{ me { email } }`)
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { me },
            },
          } = res;
          expect(me.email).toBe(NEW_EMAIL);
        });
    });

    it('should change password', () => {
      return privateTest(
        `mutation {
            editProfile(input: {password: "${NEW_PASSWORD}"}) {
              success
              error
            }
          }`,
      )
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { editProfile },
            },
          } = res;
          expect(editProfile).toEqual({
            success: true,
            error: null,
          });
        });
    });
  });
  describe('verifyEmail', () => {
    let verificationCode: string;

    beforeAll(async () => {
      const [verification] = await verificationRepository.find();
      verificationCode = verification.code;
    });
    it('should verify email', () => {
      return publicTest(`
        mutation {
          verifyEmail(input: {code: "${verificationCode}"}){
            error
            success
          }
        }
      `)
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { verifyEmail },
            },
          } = res;
          expect(verifyEmail).toEqual({ success: true, error: null });
        });
    });
    it('should fail on verification code not found', () => {
      return publicTest(`
        mutation {
          verifyEmail(input: {code: "xxx"}){
            error
            success
          }
        }
      `)
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { verifyEmail },
            },
          } = res;
          expect(verifyEmail).toEqual({
            success: false,
            error: 'Verification Not Found',
          });
        });
    });
  });
});
