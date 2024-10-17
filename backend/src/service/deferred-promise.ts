/**
 * Class used to resolve a promise from another part of the code
 */
export default class DeferredPromise {
  promise: Promise<void>;
  reject: any;
  resolve: any;

  constructor() {
    this.promise = new Promise<void>((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}
