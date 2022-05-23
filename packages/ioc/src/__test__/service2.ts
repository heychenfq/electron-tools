
import { service, inject } from '../instantiation';
import Service1 from './service1';

@service('2')
export default class Service2 {
  constructor(@inject('1') readonly service1: Service1) {}
}