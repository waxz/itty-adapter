import type { Logger } from "./log.ts"

declare global {
  interface Request {
    logger: Logger | undefined
  }
}

// Forward declare Context to avoid circular dependency
export interface Context<
  E extends Env = any,
  P extends string = any,
  I extends Input = {},
> {
  get: <Key extends keyof E['Variables']>(key: Key) => E['Variables'][Key]
  set: <Key extends keyof E['Variables']>(key: Key, value: E['Variables'][Key]) => void
  req: Request
  env: E['Bindings']
  var: Readonly<E['Variables']>
  res: Response
  render: (content: string | Promise<string>) => Response | Promise<Response>
}

import type {
  IfAnyThenEmptyObject,
  IsAny,
  JSONValue,
  RemoveBlankRecord,
  Simplify,
  UnionToIntersection,
} from "../utils/types.ts"
import type { CustomHeader, RequestHeader } from "../utils/headers.ts"
import type { StatusCode } from "../utils/http-status.ts"

export type Bindings = object
export type Variables = object

export type BlankEnv = {}
export type Env = {
  Bindings?: Bindings
  Variables?: Variables
}

export type Next = () => Promise<void>

export type ExtractInput<I extends Input | Input['in']> = I extends Input
  ? unknown extends I['in']
    ? {}
    : I['in']
  : I
export type Input = {
  in?: {}
  out?: {}
  outputFormat?: ResponseFormat
}

export type BlankSchema = {}
export type BlankInput = {}

export interface RouterRoute {
  basePath: string
  path: string
  method: string
  handler: H
}

export type HandlerResponse<O> =
  | Response
  | TypedResponse<O>
  | Promise<Response | TypedResponse<O>>
  | Promise<void>

export type Handler<
  E extends Env = any,
  P extends string = any,
  I extends Input = BlankInput,
  R extends HandlerResponse<any> = any,
> = (c: Context<E, P, I>, next: Next) => R

export type MiddlewareHandler<
  E extends Env = any,
  P extends string = string,
  I extends Input = {},
  R extends HandlerResponse<any> = Response,
> = (c: Context<E, P, I>, next: Next) => Promise<R | void>

export type H<
  E extends Env = any,
  P extends string = any,
  I extends Input = BlankInput,
  R extends HandlerResponse<any> = any,
> = Handler<E, P, I, R> | MiddlewareHandler<E, P, I, R>

export interface NotFoundResponse {}

export type NotFoundHandler<E extends Env = any> = (
  c: Context<E>
) => NotFoundResponse extends Response
  ? NotFoundResponse | Promise<NotFoundResponse>
  : Response | Promise<Response>

export interface HTTPResponseError extends Error {
  getResponse: () => Response
}
export type ErrorHandler<E extends Env = any> = (
  err: Error | HTTPResponseError,
  c: Context<E>
) => Response | Promise<Response>

export type KnownResponseFormat = 'json' | 'text' | 'redirect'
export type ResponseFormat = KnownResponseFormat | string

export type TypedResponse<
  T = unknown,
  U extends StatusCode = StatusCode,
  F extends ResponseFormat = T extends string
    ? 'text'
    : T extends JSONValue
      ? 'json'
      : ResponseFormat,
> = {
  _data: T
  _status: U
  _format: F
}

export abstract class FetchEventLike {
  abstract readonly request: Request
  abstract respondWith(promise: Response | Promise<Response>): void
  abstract passThroughOnException(): void
  abstract waitUntil(promise: Promise<void>): void
}

export type ParamIndexMap = Record<string, number>
export type ParamStash = string[]
export type Params = Record<string, string>

export type Result<T> = [[T, ParamIndexMap][], ParamStash] | [[T, Params][]]

export class UnsupportedPathError extends Error {}
