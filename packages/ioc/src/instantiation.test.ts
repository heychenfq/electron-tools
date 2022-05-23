import InstantiationService, { service, inject } from './instantiation';

@service('a')
class ServiceA {
}
@service('b')
class ServiceB {
  constructor(
    @inject('a')
    readonly a: ServiceA,
  ) {

  }
}
@service('c')
class ServiceC {
  constructor(
    @inject('a')
    readonly a: ServiceA,
    @inject('b')
    readonly b: ServiceB,
  ) {

  }
}

it('service should auto inject', () => {
  const ioc = new InstantiationService();
  expect(ioc.services.size).toBe(1);
  const serviceC = ioc.getService('c');
  expect(serviceC instanceof ServiceC).toBe(true);
  const serviceA = ioc.getService('a');
  expect(serviceA instanceof ServiceA).toBe(true);
  const serviceB = ioc.getService('b');
  expect(serviceB instanceof ServiceB).toBe(true);
  expect(serviceB.a).toBe(serviceA);
  expect(serviceC.a).toBe(serviceA);
  expect(serviceC.b).toBe(serviceB);
  expect(ioc.services.size).toBe(4);
});

it('all service should be initd after init() called', () => {
  const ioc = new InstantiationService();
  ioc.init();
  expect(ioc.services.size).toBe(4);
});

it('cycle reference should throw error', async () => {
  await import('./__test__/service1');
  await import('./__test__/service2');
  await import('./__test__/service3');
  const ioc = new InstantiationService();
  expect(ioc.init).toThrow();
});