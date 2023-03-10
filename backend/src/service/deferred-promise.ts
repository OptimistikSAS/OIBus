/**
 * Class used to resolve a promise from another variable
 * It is used in OPCHDA to resolve the connection and disconnection when the
 * HDA Agent sends the associated messages
 */
export default class DeferredPromise {
  promise: Promise<any>;
  reject: any;
  resolve: any;

  constructor() {
    this.promise = new Promise<any>((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}
