import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getConnection } from 'typeorm';

jest.mock('got');

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  email: 'imtherealk@gmail.com',
  password: '12345',
};

describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  const graphqlRequest = (query: string) =>
    request(app.getHttpServer()).post(GRAPHQL_ENDPOINT).send({ query });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
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
          expect(createAccount.success).toBe(true);
          expect(createAccount.error).toBe(null);
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
          expect(createAccount.success).toBe(false);
          expect(createAccount.error).toEqual(expect.any(String));
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
          expect(login.success).toBe(true);
          expect(login.error).toBe(null);
          expect(login.token).toEqual(expect.any(String));
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
          expect(login.success).toBe(false);
          expect(login.error).toBe('Wrong Password');
          expect(login.token).toBe(null);
        });
    });
  });
  it.todo('userProfile');
  it.todo('me');
  it.todo('verifyEmail');
  it.todo('editProfile');
});
