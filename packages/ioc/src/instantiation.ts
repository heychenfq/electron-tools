import 'reflect-metadata';
import Graph from './graph';

type ServiceUniqueId = string | Symbol;

const serviceCtorStore = new Map<ServiceUniqueId, ServiceCtor>();

export const INSTANTIATION_SERVICE_ID = Symbol.for('instantiationService');

export default class InstantiationService {
  #serviceStore = new Map<ServiceUniqueId, unknown>();

  get services() {
    return this.#serviceStore;
  }

  constructor() {
    this.#serviceStore.set(INSTANTIATION_SERVICE_ID, this);
  }

  init() {
    for (const serviceId of serviceCtorStore.keys()) {
      this.getService(serviceId);
    }
  }

  registerService(id: ServiceUniqueId, service: any): void {
    this.#serviceStore.set(id, service);
  }

  getService<S = any>(id: ServiceUniqueId): S {
    // has created, return exist service
    if (this.#serviceStore.has(id)) return this.#serviceStore.get(id) as S;
    return this.#createAndCacheService<S>(id);
  }

  #createAndCacheService<S = any>(serviceId: ServiceUniqueId): S {
    const ServiceCtor = this.#getServiceCtorById(serviceId);
    if (!ServiceCtor) throw new Error(`[InstantiationService] service ${serviceId} not found!`);

    // build graph
    const graph = new Graph<{ serviceId: ServiceUniqueId; ctor: ServiceCtor }>((node) => node.serviceId.toString());
    const stack = [{ ctor: ServiceCtor, serviceId }];
    while (stack.length) {
      const node = stack.pop()!;
      graph.lookupOrInsertNode(node);
      const dependencies: DependenciesValue = (this.#getServiceDependencies(node.ctor) || []).sort(
        (a, b) => a.parameterIndex - b.parameterIndex,
      );
      for (const dependency of dependencies) {
        if (this.#serviceStore.has(dependency.id)) continue;
        const ServiceCtor = this.#getServiceCtorById(dependency.id);
        const dependencyNode = { ctor: ServiceCtor, serviceId: dependency.id };
        if (!graph.lookup(dependencyNode)) {
          stack.push(dependencyNode);
        }
        graph.insertEdge(node, dependencyNode);
      }
    }

    while (true) {
      const roots = graph.roots();
      if (roots.length === 0) {
        if (!graph.isEmpty()) {
          throw new CyclicDependencyError(graph);
        }
        break;
      }
      for (const root of roots) {
        const { ctor: ServiceCtor, serviceId } = root.data;
        const dependencies = this.#getServiceDependencies(ServiceCtor) || [];
        const args = dependencies.map(({ id }) => this.getService(id));
        const service = new ServiceCtor(...args);
        this.#serviceStore.set(serviceId, service);
        graph.removeNode(root.data);
      }
    }
    return this.getService(serviceId);
  }

  #getServiceDependencies(Ctor: ServiceCtor): DependenciesValue {
    return Reflect.getOwnMetadata(dependencyMetadataKey, Ctor);
  }

  #getServiceCtorById(id: ServiceUniqueId): ServiceCtor {
    if (!serviceCtorStore.has(id)) {
      throw new Error(`service ${id} not found!`);
    }
    return serviceCtorStore.get(id)!;
  }
}

export type DependenciesValue = Array<{
  id: string;
  parameterKey: string;
  parameterIndex: number;
}>;

interface ServiceCtor<T = any, A extends any[] = any[]> {
  new (...args: A): T;
}

class CyclicDependencyError extends Error {
  constructor(graph: Graph<any>) {
    super('cyclic dependency between services');
    this.message = graph.findCycleSlow() ?? `UNABLE to detect cycle, dumping graph: \n${graph.toString()}`;
  }
}

const dependencyMetadataKey = Symbol.for('$di$dependency');

export function register(id: ServiceUniqueId, Ctor: ServiceCtor) {
  if (serviceCtorStore.has(id)) throw new Error(`service ${id} already exist, do not register again`);
  serviceCtorStore.set(id, Ctor);
}

export function service(id?: ServiceUniqueId) {
  return (Ctor: ServiceCtor) => {
    const serviceId = id || Ctor.name.slice(0, 1).toLowerCase().concat(Ctor.name.slice(1));
    if (serviceCtorStore.has(serviceId)) throw new Error(`service ${serviceId} already exist, do not register again`);
    serviceCtorStore.set(serviceId, Ctor);
  };
}

export function inject(id: ServiceUniqueId) {
  return (Ctor: ServiceCtor, parameterKey: string, parameterIndex: number) => {
    if (Reflect.hasOwnMetadata(dependencyMetadataKey, Ctor)) {
      const dependencies = Reflect.getOwnMetadata(dependencyMetadataKey, Ctor);
      Reflect.defineMetadata(
        dependencyMetadataKey,
        [
          ...dependencies,
          {
            id,
            parameterKey,
            parameterIndex,
          },
        ],
        Ctor,
      );
    } else {
      Reflect.defineMetadata(
        dependencyMetadataKey,
        [
          {
            id,
            parameterKey,
            parameterIndex,
          },
        ],
        Ctor,
      );
    }
  };
}
