const getMessageId = (() => {
  let messageId = 0n;
  return (useString: boolean = false) => {
    const id = messageId;
    messageId += 1n;
    return useString ? id.toString(36) : id;
  };
})();

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export interface RequestMessage {
  id: bigint | string;
  path: string;
  payload: any;
}

export interface ResponseMessage {
  id: bigint | string;
  ok: boolean;
  done: boolean;
  payload: any;
}

const isResponseMessage = (
  id: bigint | string,
  data: any
): data is Partial<ResponseMessage> => {
  if (typeof data !== "object" || data === null) return false;
  if (!("id" in data) || data.id !== id) return false;
  return true;
};

interface RequestResultCommon {
  id: bigint | string;
  path: string;
}
export interface RequestResultNonStreaming extends RequestResultCommon {
  streaming: false;
  payload: any;
}
export interface RequestResultStreaming extends RequestResultCommon {
  streaming: true;
  header: any;
  body: AsyncIterable<any>;
}
export type RequestResult = RequestResultNonStreaming | RequestResultStreaming;

export type Unsubscriber = () => void;

export const createRequest = ({
  path,
  payload,
  transfrer,
  timeout,
  postMessage,
  onMessage,
}: {
  path: string;
  payload?: any;
  transfrer?: any[];
  timeout?: number;
  postMessage?(message: unknown, transfer?: unknown[]): void;
  onMessage?(listener: (messge: unknown) => void): Unsubscriber;
}) => {
  transfrer ??= [];
  timeout ??= 200;
  postMessage ??= globalThis.postMessage;
  onMessage ??= (listener) => {
    const sub = (ev: MessageEvent) => listener(ev.data);
    globalThis.addEventListener("message", sub);
    return () => globalThis.removeEventListener("message", sub);
  };

  const id = getMessageId();
  let resolved = false;
  const { promise, resolve, reject } = Promise.withResolvers<RequestResult>();

  delay(timeout).then(() => {
    if (resolved) return;
    reject(new Error("Request timed out"));
    unsub();
  });

  const unsub = onMessage((msg) => {
    if (resolved || !isResponseMessage(id, msg)) return;

    unsub();
    resolved = true;

    const { done, payload, ok } = msg as Partial<ResponseMessage>;
    if (!ok) {
      throw payload;
    }
    if (done) {
      resolve({
        id,
        path,
        streaming: false,
        payload,
      });
    } else {
      const messages: Partial<ResponseMessage>[] = [];
      let cont: (() => void) | undefined;

      const unsub = onMessage!((msg) => {
        if (!isResponseMessage(id, msg)) return;
        messages.push(msg);
        cont?.();
      });

      resolve({
        id,
        path,
        streaming: true,
        header: payload,
        body: (async function* () {
          while (true) {
            while (messages.length > 0) {
              const { ok, done, payload } = messages.shift() ?? {};
              if (!ok) {
                throw payload;
              }
              yield payload;
              if (done) {
                unsub();
                return;
              }
            }

            const p = Promise.withResolvers<void>();
            cont = p.resolve;
            await p.promise;
          }
        })(),
      });
    }
  });

  postMessage({
    id,
    path,
    payload,
  } satisfies RequestMessage);

  return promise;
};

export const createServer = () => {};
