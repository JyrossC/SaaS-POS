import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return a healthy API payload', () => {
    expect(appController.getHealth()).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'saas-pos-api',
      }),
    );
  });
});
