import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getConnection, Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

jest.mock('got');

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  email: 'imtherealk@gmail.com',
  password: '12345',
};

describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let usersRepository: Repository<User>;
  let jwtToken: string;

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
          jwtToken = login.token;
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
      const headers = { 'X-JWT': jwtToken };
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
        headers,
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
      const headers = { 'X-JWT': jwtToken };
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
        headers,
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
      const headers = { 'X-JWT': 'haha' };
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
        headers,
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
      const headers = { 'X-JWT': jwtToken };
      return graphqlRequest(`{ me { email } }`, headers)
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
      const headers = { 'X-JWT': 'haha' };
      return graphqlRequest(`{ me { email } }`, headers)
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
  it.todo('verifyEmail');
  it.todo('editProfile');
});
