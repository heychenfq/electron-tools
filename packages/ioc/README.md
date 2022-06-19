# @electron-tools/ioc

## Introduction

A simple DI implement of IOC using typescript. inspired by vscode IOC implement.

## Installation

```bash
# install by npm
$npm install @electron-tools/ioc
# install by pnpm
$pnpm add @electron-tools/ioc
# install by yarn
$yarn add @electron-tools/ioc
```

## Usage

1. enable `experimentalDecorators` option in your tsconfig.json.

2. register your service by `service` decorator exported from this package.

```ts
// src/serviceA.ts
import { service } from '@electron-tools/ioc';

@service('serviceA') // register ServiceA with unique id 'serviceA' using service decorator exported by this package.
class ServiceA {
  // ....
}
```

3. use `inject` decorator inject your service to another service.

```ts
// src/serviceB.ts
import { service, inject } from '@electron-tools/ioc';

@service('serviceB') // also register ServiceB with unique id 'serviceB'
class ServiceB {
  constructor(
    @inject('serviceA') // inject serviceA to serviceB, the only args passed to inject is the service unique id.
    readonly serviceA: ServiceA,
  ) {}
}
```

4. import all your services and crate a IOC instance in your entry file.

```ts
// src/index.ts
import IOC from '@electron-tools/ioc';
import './serviceA.ts';
import './serviceB.ts';

const ioc = new IOC();
const serviceA = ioc.getService('serviceA');
const serviceB = ioc.getService('serviceB');
console.log(serviceA instanceof ServiceA); // true
console.log(serviceB instanceof ServiceB); // true
console.log(serviceA === serviceB.a); // true
```

## Features

1. Instance all service in one place.  
   by default. service only be instanced when needed. in the case above. if you only call `ioc.getService('serviceA')`, serviceB will not be instance, cause serviceB is not dependencied by any service, but if you only call `ioc.getService('serviceB')`, serviceA will be instance, and inject into serviceB. this maybe not what you want. you can init all services in one place by call `ioc.init()`.

```ts
const ioc = new IOC();
ioc.init(); // this statement will instance all services registered.
```

2. Cycle reference.
   if there are some cycle reference between your services. such as serviceA dependencied by serviceB, serviceB also dependencied by serviceA, you can resolve this issue by get service later instead of constructor of service.

```ts
// src/serviceA.ts
import IOC, { service, inject, INSTANTIATION_SERVICE_ID } from '@electron-tools/ioc';

@service('serviceA') // register ServiceA with unique id 'serviceA' using service decorator exported by ioc.
class ServiceA {
  constructor(
    @inject(INSTANTIATION_SERVICE_ID) readonly ioc: IOC, // ioc itself is also a service can be injected.
  ) {}

  someMethod() {
    // dynamic get serviceB by ioc#getService API. then you can do anything what serviceB can do.
    const serviceB = this.ioc.getService('serviceB');
    serviceB.xxx;
  }
}
```
