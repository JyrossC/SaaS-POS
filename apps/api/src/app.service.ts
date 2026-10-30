export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'saas-pos-api',
      timestamp: new Date().toISOString(),
      architecture: 'modular-monolith',
    };
  }
}
