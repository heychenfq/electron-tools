import 'reflect-metadata';
import Graph from './graph';

const serviceCtorStore = new Map<string, ServiceCtor>();

export default class InstantiationService {
  #serviceStore = new Map<string, unknown>();

  get services() {
    return this.#serviceStore;
  }

  constructor() {
    this.#serviceStore.set('instantiationService', this);
  }

  init() {
    for (const serviceId of serviceCtorStore.keys()) {
      this.getService(serviceId);
    }
  }

  getService<T = any>(id: string): T {
    // has created, return exist service
    if (this.#serviceStore.has(id)) return this.#serviceStore.get(id) as T;
    return this.#createAndCacheService(id);
  }

  #createAndCacheService<T = any>(serviceId: string): T {
    const ServiceCtor = this.#getServiceCtorById(serviceId);
    if (!ServiceCtor) throw new Error(`[InstantiationService] service ${serviceId} not found!`);

    // build graph
    const graph = new Graph<{ serviceId: string; ctor: ServiceCtor }>((node) => node.serviceId);
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

  #getServiceCtorById(id: string): ServiceCtor {
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

export function service(id?: string) {
  return (Ctor: ServiceCtor) => {
    const serviceId = id || Ctor.name.slice(0, 1).toLowerCase().concat(Ctor.name.slice(1));
    if (serviceCtorStore.has(serviceId)) throw new Error(`service ${serviceId} already exist, do not register again`);
    serviceCtorStore.set(serviceId, Ctor);
  };
}

export function inject(id: string) {
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
