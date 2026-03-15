import { HonoBase } from './hono-base.ts'
import type { HonoOptions } from './hono-base.ts'
// import { RegExpRouter } from './router/reg-exp-router.ts'
// import { SmartRouter } from './router/smart-router.ts'
// import { TrieRouter } from './router/trie-router.ts'
import type { Result, Router } from "./router.ts"
import { MESSAGE_MATCHER_IS_ALREADY_BUILT, UnsupportedPathError } from "./router.ts"

class SmartRouter<T> implements Router<T> {
  name: string = 'SmartRouter'
  #routers: Router<T>[] = []
  #routes?: [string, string, T][] = []

  constructor(init: { routers: Router<T>[] }) {
    this.#routers = init.routers
  }

  add(method: string, path: string, handler: T) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT)
    }

    this.#routes.push([method, path, handler])
  }

  match(method: string, path: string): Result<T> {
    if (!this.#routes) {
      throw new Error('Fatal error')
    }

    const routers = this.#routers
    const routes = this.#routes

    const len = routers.length
    let i = 0
    let res
    for (; i < len; i++) {
      const router = routers[i]
      try {
        for (let i = 0, len = routes.length; i < len; i++) {
          router.add(...routes[i])
        }
        res = router.match(method, path)
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue
        }
        throw e
      }

      this.match = router.match.bind(router)
      this.#routers = [router]
      this.#routes = undefined
      break
    }

    if (i === len) {
      // not found
      throw new Error('Fatal error')
    }

    // e.g. "SmartRouter + RegExpRouter"
    this.name = `SmartRouter + ${this.activeRouter.name}`

    return res as Result<T>
  }

  get activeRouter(): Router<T> {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error('No active router has been determined yet.')
    }

    return this.#routers[0]
  }
}

class RegExpRouter<T> implements Router<T> {
  name: string = 'SmartRouter'
  #routers: Router<T>[] = []
  #routes?: [string, string, T][] = []

  constructor( ) {
  }

  add(method: string, path: string, handler: T) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT)
    }

    this.#routes.push([method, path, handler])
  }

  match(method: string, path: string): Result<T> {
    if (!this.#routes) {
      throw new Error('Fatal error')
    }

    const routers = this.#routers
    const routes = this.#routes

    const len = routers.length
    let i = 0
    let res
    for (; i < len; i++) {
      const router = routers[i]
      try {
        for (let i = 0, len = routes.length; i < len; i++) {
          router.add(...routes[i])
        }
        res = router.match(method, path)
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue
        }
        throw e
      }

      this.match = router.match.bind(router)
      this.#routers = [router]
      this.#routes = undefined
      break
    }

    if (i === len) {
      // not found
      throw new Error('Fatal error')
    }

    // e.g. "SmartRouter + RegExpRouter"
    this.name = `SmartRouter + ${this.activeRouter.name}`

    return res as Result<T>
  }

  get activeRouter(): Router<T> {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error('No active router has been determined yet.')
    }

    return this.#routers[0]
  }
}
class TrieRouter<T> implements Router<T> {
  name: string = 'TrieRouter'
  #routers: Router<T>[] = []
  #routes?: [string, string, T][] = []

  constructor( ) {
  }

  add(method: string, path: string, handler: T) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT)
    }

    this.#routes.push([method, path, handler])
  }

  match(method: string, path: string): Result<T> {
    if (!this.#routes) {
      throw new Error('Fatal error')
    }

    const routers = this.#routers
    const routes = this.#routes

    const len = routers.length
    let i = 0
    let res
    for (; i < len; i++) {
      const router = routers[i]
      try {
        for (let i = 0, len = routes.length; i < len; i++) {
          router.add(...routes[i])
        }
        res = router.match(method, path)
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue
        }
        throw e
      }

      this.match = router.match.bind(router)
      this.#routers = [router]
      this.#routes = undefined
      break
    }

    if (i === len) {
      // not found
      throw new Error('Fatal error')
    }

    // e.g. "SmartRouter + RegExpRouter"
    this.name = `SmartRouter + ${this.activeRouter.name}`

    return res as Result<T>
  }

  get activeRouter(): Router<T> {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error('No active router has been determined yet.')
    }

    return this.#routers[0]
  }
}

import type { BlankEnv, BlankSchema, Env, Schema } from './types.ts'

/**
 * The Hono class extends the functionality of the HonoBase class.
 * It sets up routing and allows for custom options to be passed.
 *
 * @template E - The environment type.
 * @template S - The schema type.
 * @template BasePath - The base path type.
 */
export class Hono<
  E extends Env = BlankEnv,
  S extends Schema = BlankSchema,
  BasePath extends string = '/',
> extends HonoBase<E, S, BasePath> {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options: HonoOptions<E> = {}) {
    super(options)
    this.router =
      options.router ??
      new SmartRouter({
        routers: [new RegExpRouter(), new TrieRouter()],
      })
  }
}
