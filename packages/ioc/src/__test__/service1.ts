
import { service, inject } from '../instantiation';
import Service3 from './service3';

@service('1')
export default class Service1 {
  constructor(@inject('3') readonly service3: Service3) {}
}