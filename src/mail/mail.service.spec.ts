import { Test } from '@nestjs/testing';
import * as FormData from 'form-data';
import got from 'got';
import { CONFIG_OPTIONS } from 'src/common/common.constants';
import { MailService } from './mail.service';

jest.mock('got');
jest.mock('form-data');

const API_KEY = 'testApiKey';
const TEST_DOMAIN = 'testDomain';

describe('MailService', () => {
  let service: MailService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: CONFIG_OPTIONS,
          useValue: {
            apiKey: API_KEY,
            domain: TEST_DOMAIN,
            fromEmail: 'testFromEmail',
          },
        },
      ],
    }).compile();
    service = module.get<MailService>(MailService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('sendVerificationEmail', () => {
    it('should call sendEmail', () => {
      const sendVerificationEmailArgs = {
        email: 'email',
        code: 'code',
      };
      jest.spyOn(service, 'sendEmail').mockImplementation(async () => true);
      const result = service.sendVerificationEmail(
        sendVerificationEmailArgs.email,
        sendVerificationEmailArgs.code,
      );
      expect(service.sendEmail).toHaveBeenCalledTimes(1);
      expect(service.sendEmail).toHaveBeenCalledWith(
        'Confirm Your Account',
        'verify-email',
        sendVerificationEmailArgs.email,
        [
          { key: 'code', value: sendVerificationEmailArgs.code },
          { key: 'username', value: sendVerificationEmailArgs.email },
        ],
      );
      expect(result).toBe(undefined);
    });

    describe('sendEmail', () => {
      it('should send email', async () => {
        const formSpy = jest.spyOn(FormData.prototype, 'append');
        const result = await service.sendEmail('', '', '', [
          { key: 'one', value: '1' },
        ]);
        expect(formSpy).toHaveBeenCalled();
        expect(got.post).toHaveBeenCalledTimes(1);
        expect(got.post).toHaveBeenCalledWith(
          `https://api.mailgun.net/v3/${TEST_DOMAIN}/messages`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString(
                'base64',
              )}`,
            },
            body: expect.any(FormData),
          },
        );
        expect(result).toEqual(true);
      });

      it('should fail on error', async () => {
        jest.spyOn(got, 'post').mockImplementation(() => {
          throw new Error();
        });
        const result = await service.sendEmail('', '', '', [
          { key: 'one', value: '1' },
        ]);
        expect(result).toEqual(false);
      });
    });
  });
});
