import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getConnection, Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Verification } from 'src/users/entities/verification.entity';

jest.mock('got');

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  email: 'immda@naver.com',
  password: '12345',
};

const tokenHeaders: Record<string, string> = { 'X-JWT': '' };

describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let usersRepository: Repository<User>;
  let verificationRepository: Repository<Verification>;

  const graphqlRequest = (
    query: string,
    headers: Record<string, string | never> = {},
  ) =>
    request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .set(headers)
      .send({ query });

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
      return graphqlRequest(`
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
      return graphqlRequest(`
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
      return graphqlRequest(`
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
          tokenHeaders['X-JWT'] = login.token;
        });
    });

    it('should not be able to login with wrong credentials.', () => {
      return graphqlRequest(`
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
      return graphqlRequest(
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
        tokenHeaders,
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
      return graphqlRequest(
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
        tokenHeaders,
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
      const worngHeaders = { 'X-JWT': 'haha' };
      return graphqlRequest(
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
        worngHeaders,
      )
        .expect(200)
        .expect(res => {
          const {
            body: {
              errors: [{ message }],
            },
          } = res;
          expect(message).toEqual('Forbidden resource');
        });
    });
  });

  describe('me', () => {
    it('should find my profile', () => {
      return graphqlRequest(`{ me { email } }`, tokenHeaders)
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
      const worngHeaders = { 'X-JWT': 'haha' };
      return graphqlRequest(`{ me { email } }`, worngHeaders)
        .expect(200)
        .expect(res => {
          const {
            body: {
              errors: [{ message }],
            },
          } = res;
          expect(message).toEqual('Forbidden resource');
        });
    });
  });

  describe('editProfile', () => {
    const NEW_EMAIL = 'imtherealk@gmail.com';
    const NEW_PASSWORD = '54321';

    it('should change email', () => {
      return graphqlRequest(
        `mutation {
            editProfile(input: {email: "${NEW_EMAIL}"}) {
              success
              error
            }
          }`,
        tokenHeaders,
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
      return graphqlRequest(`{ me { email } }`, tokenHeaders)
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
      return graphqlRequest(
        `mutation {
            editProfile(input: {password: "${NEW_PASSWORD}"}) {
              success
              error
            }
          }`,
        tokenHeaders,
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
      return graphqlRequest(`
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
      return graphqlRequest(`
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
