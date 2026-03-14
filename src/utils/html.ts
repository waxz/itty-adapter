/**
 * @module
 * HTML utility.
 */

export const HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3,
} as const
type HtmlEscapedCallbackOpts = {
  buffer?: [string]
  phase: (typeof HtmlEscapedCallbackPhase)[keyof typeof HtmlEscapedCallbackPhase]
  context: Readonly<object>
}
export type HtmlEscapedCallback = (opts: HtmlEscapedCallbackOpts) => Promise<string> | undefined
export type HtmlEscaped = {
  isEscaped: true
  callbacks?: HtmlEscapedCallback[]
}
export type HtmlEscapedString = string & HtmlEscaped

export type StringBuffer = (string | Promise<string>)[]
export type StringBufferWithCallbacks = StringBuffer & { callbacks: HtmlEscapedCallback[] }

export const raw = (value: unknown, callbacks?: HtmlEscapedCallback[]): HtmlEscapedString => {
  const escapedString = new String(value) as HtmlEscapedString
  escapedString.isEscaped = true
  if (callbacks) {
    escapedString.callbacks = callbacks
  }

  return escapedString
}

const escapeRe = /[&<>'"]/

export const stringBufferToString = async (
  buffer: StringBuffer,
  callbacks: HtmlEscapedCallback[] | undefined
): Promise<HtmlEscapedString> => {
  let str = ''
  callbacks ||= []
  const resolvedBuffer = await Promise.all(buffer)
  for (let i = resolvedBuffer.length - 1; ; i--) {
    str += resolvedBuffer[i]
    i--
    if (i < 0) {
      break
    }

    let r = resolvedBuffer[i]
    if (typeof r === 'object') {
      callbacks.push(...((r as HtmlEscapedString).callbacks || []))
    }

    const isEscaped = (r as HtmlEscapedString).isEscaped
    r = await (typeof r === 'object' ? (r as HtmlEscapedString).toString() : r)
    if (typeof r === 'object') {
      callbacks.push(...((r as HtmlEscapedString).callbacks || []))
    }

    if ((r as HtmlEscapedString).isEscaped ?? isEscaped) {
      str += r
    } else {
      const resolvedR = r ?? ''
      const buf = [str]
      escapeToBuffer(resolvedR, buf)
      str = buf[0] ?? str
    }
  }

  return raw(str, callbacks)
}

export const escapeToBuffer = (str: string, buffer: StringBuffer): void => {
  const match = str.search(escapeRe)
  if (match === -1) {
    buffer[0] += str
    return
  }

  let escape
  let index
  let lastIndex = 0

  for (index = match; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;'
        break
      case 39: // '
        escape = '&#39;'
        break
      case 38: // &
        escape = '&amp;'
        break
      case 60: // <
        escape = '&lt;'
        break
      case 62: // >
        escape = '&gt;'
        break
      default:
        continue
    }

    buffer[0] += str.substring(lastIndex, index) + escape
    lastIndex = index + 1
  }

  buffer[0] += str.substring(lastIndex, index)
}

export const resolveCallbackSync = (str: string | HtmlEscapedString): string => {
  const callbacks = (str as HtmlEscapedString).callbacks as HtmlEscapedCallback[]
  if (!callbacks?.length) {
    return str
  }
  const buffer: [string] = [str]
  const context = {}

  callbacks.forEach((c) => c({ phase: HtmlEscapedCallbackPhase.Stringify, buffer, context }))

  return buffer[0]
}

export const resolveCallback = async (
  str: string | HtmlEscapedString | Promise<string>,
  phase: (typeof HtmlEscapedCallbackPhase)[keyof typeof HtmlEscapedCallbackPhase],
  preserveCallbacks: boolean,
  context: object,
  buffer?: [string]
): Promise<string> => {
  if (typeof str === 'object' && !(str instanceof String)) {
    if (!((str as unknown) instanceof Promise)) {
      str = (str as unknown as string).toString()
    }
    if ((str as string | Promise<string>) instanceof Promise) {
      str = await (str as unknown as Promise<string>)
    }
  }

  const callbacks = (str as HtmlEscapedString).callbacks as HtmlEscapedCallback[]
  if (!callbacks?.length) {
    return Promise.resolve(str)
  }
  if (buffer) {
    buffer[0] += str
  } else {
    buffer = [str as string]
  }

  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then((res) =>
    Promise.all(
      res
        .filter<string>(Boolean as any)
        .map((str) => resolveCallback(str, phase, false, context, buffer))
    ).then(() => (buffer as [string])[0])
  )

  if (preserveCallbacks) {
    return raw(await resStr, callbacks)
  } else {
    return resStr
  }
}
