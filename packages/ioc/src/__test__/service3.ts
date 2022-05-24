import { service, inject } from '../instantiation';
import Service2 from './service2';

@service('3')
export default class Service3 {
  constructor(@inject('2') readonly service2: Service2) {}
}
