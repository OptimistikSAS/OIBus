// Options the database drivers support but their typings leave out
import 'mssql';
import 'pg';

declare module 'mssql' {
  interface ConnectionPool {
    /** A request whose timeout overrides the request timeout of the pool */
    request(overrides?: { requestTimeout?: number }): Request;
  }
}

declare module 'pg' {
  // The type parameter must be the one of @types/pg for the declarations to merge
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  interface QueryConfig<I = Array<any>> {
    /** Client-side timeout of the query, overriding the one of the client */
    query_timeout?: number;
  }
}
