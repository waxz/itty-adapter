import type { Result } from './adapter/types.ts'
import type {
  Env,
  FetchEventLike,
  H,
  Input,
  NotFoundHandler,
  RouterRoute,
  TypedResponse,
} from './adapter/types.ts'
import type { ResponseHeader } from './utils/headers.ts'
import { HtmlEscapedCallbackPhase, resolveCallback } from './utils/html.ts'
import type { ContentfulStatusCode, RedirectStatusCode, StatusCode } from './utils/http-status.ts'
import type { BaseMime } from './utils/mime.ts'
import type { InvalidJSONValue, IsAny, JSONParsed, JSONValue } from './utils/types.ts'

type HeaderRecord =
  | Record<'Content-Type', BaseMime>
  | Record<ResponseHeader, string | string[]>
  | Record<string, string | string[]>

export type Data = string | ArrayBuffer | ReadableStream | Uint8Array<ArrayBuffer>

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
  props: unknown
  exports?: unknown
}

export interface ContextVariableMap {}
export interface ContextRenderer {}
interface DefaultRenderer {
  (content: string | Promise<string>): Response | Promise<Response>
}
export type Renderer = ContextRenderer extends Function ? ContextRenderer : DefaultRenderer

export type PropsForRenderer = [...Required<Parameters<Renderer>>] extends [unknown, infer Props]
  ? Props
  : unknown

export type Layout<T = Record<string, unknown>> = (props: T) => unknown

interface Get<E extends Env> {
  <Key extends keyof E['Variables']>(key: Key): E['Variables'][Key]
  <Key extends keyof ContextVariableMap>(key: Key): ContextVariableMap[Key]
}

interface Set<E extends Env> {
  <Key extends keyof E['Variables']>(key: Key, value: E['Variables'][Key]): void
  <Key extends keyof ContextVariableMap>(key: Key, value: ContextVariableMap[Key]): void
}

interface NewResponse {
  (data: Data | null, status?: StatusCode, headers?: HeaderRecord): Response
  (data: Data | null, init?: ResponseOrInit): Response
}

interface BodyRespond {
  <T extends Data, U extends ContentfulStatusCode>(
    data: T,
    status?: U,
    headers?: HeaderRecord
  ): Response & TypedResponse<T, U, 'body'>
  <T extends Data, U extends ContentfulStatusCode>(
    data: T,
    init?: ResponseOrInit<U>
  ): Response & TypedResponse<T, U, 'body'>
  <T extends null, U extends StatusCode>(
    data: T,
    status?: U,
    headers?: HeaderRecord
  ): Response & TypedResponse<null, U, 'body'>
  <T extends null, U extends StatusCode>(
    data: T,
    init?: ResponseOrInit<U>
  ): Response & TypedResponse<null, U, 'body'>
}

interface TextRespond {
  <T extends string, U extends ContentfulStatusCode = ContentfulStatusCode>(
    text: T,
    status?: U,
    headers?: HeaderRecord
  ): Response & TypedResponse<T, U, 'text'>
  <T extends string, U extends ContentfulStatusCode = ContentfulStatusCode>(
    text: T,
    init?: ResponseOrInit<U>
  ): Response & TypedResponse<T, U, 'text'>
}

interface JSONRespond {
  <T extends JSONValue | {} | InvalidJSONValue, U extends ContentfulStatusCode = ContentfulStatusCode>(
    object: T,
    status?: U,
    headers?: HeaderRecord
  ): JSONRespondReturn<T, U>
  <T extends JSONValue | {} | InvalidJSONValue, U extends ContentfulStatusCode = ContentfulStatusCode>(
    object: T,
    init?: ResponseOrInit<U>
  ): JSONRespondReturn<T, U>
}

type JSONRespondReturn<
  T extends JSONValue | {} | InvalidJSONValue,
  U extends ContentfulStatusCode,
> = Response & TypedResponse<JSONParsed<T>, U, 'json'>

interface HTMLRespond {
  <T extends string | Promise<string>>(
    html: T,
    status?: ContentfulStatusCode,
    headers?: HeaderRecord
  ): T extends string ? Response : Promise<Response>
  <T extends string | Promise<string>>(
    html: T,
    init?: ResponseOrInit<ContentfulStatusCode>
  ): T extends string ? Response : Promise<Response>
}

type ContextOptions<E extends Env> = {
  env: E['Bindings']
  executionCtx?: FetchEventLike | ExecutionContext | undefined
  notFoundHandler?: NotFoundHandler<E>
  matchResult?: Result<[H, RouterRoute]>
  path?: string
}

interface SetHeadersOptions {
  append?: boolean
}

interface SetHeaders {
  (name: 'Content-Type', value?: BaseMime, options?: SetHeadersOptions): void
  (name: ResponseHeader, value?: string, options?: SetHeadersOptions): void
  (name: string, value?: string, options?: SetHeadersOptions): void
}

type ResponseHeadersInit =
  | [string, string][]
  | Record<'Content-Type', BaseMime>
  | Record<ResponseHeader, string>
  | Record<string, string>
  | Headers

interface ResponseInit<T extends StatusCode = StatusCode> {
  headers?: ResponseHeadersInit
  status?: T
  statusText?: string
}

type ResponseOrInit<T extends StatusCode = StatusCode> = ResponseInit<T> | Response

export const TEXT_PLAIN = 'text/plain; charset=UTF-8'

const setDefaultContentType = (contentType: string, headers?: HeaderRecord): HeaderRecord => {
  return {
    'Content-Type': contentType,
    ...headers,
  }
}

const createResponseInstance = (
  body?: BodyInit | null | undefined,
  init?: globalThis.ResponseInit
): Response => new Response(body, init)

export class Context<
  E extends Env = any,
  P extends string = any,
  I extends Input = {},
> {
  #rawRequest: Request
  env: E['Bindings'] = {}
  #var: Map<unknown, unknown> | undefined
  finalized: boolean = false
  error: Error | undefined

  #status: StatusCode | undefined
  #executionCtx: FetchEventLike | ExecutionContext | undefined
  #res: Response | undefined
  #layout: Layout<PropsForRenderer & { Layout: Layout }> | undefined
  #renderer: Renderer | undefined
  #notFoundHandler: NotFoundHandler<E> | undefined
  #preparedHeaders: Headers | undefined

  #matchResult: Result<[H, RouterRoute]> | undefined
  #path: string | undefined

  constructor(req: Request, options?: ContextOptions<E>) {
    this.#rawRequest = req
    if (options) {
      this.#executionCtx = options.executionCtx
      this.env = options.env
      this.#notFoundHandler = options.notFoundHandler
      this.#path = options.path
      this.#matchResult = options.matchResult
    }
  }

  get req(): Request {
    return this.#rawRequest
  }

  get event(): FetchEventLike {
    if (this.#executionCtx && 'respondWith' in this.#executionCtx) {
      return this.#executionCtx
    } else {
      throw Error('This context has no FetchEvent')
    }
  }

  get executionCtx(): ExecutionContext {
    if (this.#executionCtx) {
      return this.#executionCtx as ExecutionContext
    } else {
      throw Error('This context has no ExecutionContext')
    }
  }

  get res(): Response {
    return (this.#res ||= createResponseInstance(null, {
      headers: (this.#preparedHeaders ??= new Headers()),
    }))
  }

  set res(_res: Response | undefined) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res)
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === 'content-type') {
          continue
        }
        if (k === 'set-cookie') {
          const cookies = this.#res.headers.getSetCookie()
          _res.headers.delete('set-cookie')
          for (const cookie of cookies) {
            _res.headers.append('set-cookie', cookie)
          }
        } else {
          _res.headers.set(k, v)
        }
      }
    }
    this.#res = _res
    this.finalized = true
  }

  render: Renderer = (...args) => {
    this.#renderer ??= (content: string | Promise<string>) => this.html(content)
    return this.#renderer(...args)
  }

  setLayout = (
    layout: Layout<PropsForRenderer & { Layout: Layout }>
  ): Layout<
    PropsForRenderer & {
      Layout: Layout
    }
  > => (this.#layout = layout)

  getLayout = (): Layout<PropsForRenderer & { Layout: Layout }> | undefined => this.#layout

  setRenderer = (renderer: Renderer): void => {
    this.#renderer = renderer
  }

  header: SetHeaders = (name, value, options): void => {
    if (this.finalized) {
      this.#res = createResponseInstance((this.#res as Response).body, this.#res)
    }
    const headers = this.#res ? this.#res.headers : (this.#preparedHeaders ??= new Headers())
    if (value === undefined) {
      headers.delete(name)
    } else if (options?.append) {
      headers.append(name, value)
    } else {
      headers.set(name, value)
    }
  }

  status = (status: StatusCode): void => {
    this.#status = status
  }

  set: Set<
    IsAny<E> extends true
      ? {
          Variables: ContextVariableMap & Record<string, unknown>
        }
      : E
  > = (key: string, value: unknown) => {
    this.#var ??= new Map()
    this.#var.set(key, value)
  }

  get: Get<
    IsAny<E> extends true
      ? {
          Variables: ContextVariableMap & Record<string, unknown>
        }
      : E
  > = (key: string) => {
    return this.#var ? this.#var.get(key) : undefined
  }

  get var(): Readonly<
    ContextVariableMap & (IsAny<E['Variables']> extends true ? Record<string, unknown> : E['Variables'])
  > {
    if (!this.#var) {
      return {} as never
    }
    return Object.fromEntries(this.#var)
  }

  #newResponse(
    data: Data | null,
    arg?: StatusCode | ResponseOrInit,
    headers?: HeaderRecord
  ): Response {
    const responseHeaders = this.#res
      ? new Headers(this.#res.headers)
      : (this.#preparedHeaders ?? new Headers())

    if (typeof arg === 'object' && 'headers' in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers)
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === 'set-cookie') {
          responseHeaders.append(key, value)
        } else {
          responseHeaders.set(key, value)
        }
      }
    }

    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === 'string') {
          responseHeaders.set(k, v)
        } else {
          responseHeaders.delete(k)
          for (const v2 of v) {
            responseHeaders.append(k, v2)
          }
        }
      }
    }

    const status = typeof arg === 'number' ? arg : (arg?.status ?? this.#status) ?? 200
    return createResponseInstance(data, { status, headers: responseHeaders })
  }

  newResponse: NewResponse = (...args) => this.#newResponse(...(args as Parameters<NewResponse>))

  body: BodyRespond = (
    data: Data | null,
    arg?: StatusCode | RequestInit,
    headers?: HeaderRecord
  ): ReturnType<BodyRespond> => this.#newResponse(data, arg, headers) as ReturnType<BodyRespond>

  text: TextRespond = (
    text: string,
    arg?: ContentfulStatusCode | ResponseOrInit,
    headers?: HeaderRecord
  ): ReturnType<TextRespond> => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized
      ? (new Response(text) as ReturnType<TextRespond>)
      : (this.#newResponse(
          text,
          arg,
          setDefaultContentType(TEXT_PLAIN, headers)
        ) as ReturnType<TextRespond>)
  }

  json: JSONRespond = <
    T extends JSONValue | {} | InvalidJSONValue,
    U extends ContentfulStatusCode = ContentfulStatusCode,
  >(
    object: T,
    arg?: U | ResponseOrInit<U>,
    headers?: HeaderRecord
  ): JSONRespondReturn<T, U> => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType('application/json', headers)
    ) as unknown as JSONRespondReturn<T, U>
  }

  html: HTMLRespond = (
    html: string | Promise<string>,
    arg?: ContentfulStatusCode | ResponseOrInit<ContentfulStatusCode>,
    headers?: HeaderRecord
  ): Response | Promise<Response> => {
    const res = (html: string) =>
      this.#newResponse(html, arg, setDefaultContentType('text/html; charset=UTF-8', headers))
    return typeof html === 'object'
      ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res)
      : res(html)
  }

  redirect = <T extends RedirectStatusCode = 302>(
    location: string | URL,
    status?: T
  ): Response & TypedResponse<undefined, T, 'redirect'> => {
    const locationString = String(location)
    this.header(
      'Location',
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    )
    return this.newResponse(null, status ?? 302) as unknown as Response & TypedResponse<undefined, T, 'redirect'>
  }

  notFound = (): Response | Promise<Response> => {
    const handler = this.#notFoundHandler ?? (() => createResponseInstance())
    return handler(this as any)
  }
}
