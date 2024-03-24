import {
  RequestResultType,
  type RequestMessage,
  type RequestResult,
  type ResponseMessage,
  type Unsubscriber,
} from "../types.ts";

const getMessageId = (() => {
  let messageId = 0n;
  return (useString: boolean = false) => {
    const id = messageId;
    messageId += 1n;
    return useString ? id.toString(36) : id;
  };
})();

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const isResponseMessage = (
  id: bigint | string,
  data: any
): data is Partial<ResponseMessage> => {
  if (typeof data !== "object" || data === null) return false;
  if (!("id" in data) || data.id !== id) return false;
  return true;
};

export const createRequest = <T = any>({
  data,
  transfrer,
  timeout,
  postMessage,
  onMessage,
}: {
  data?: T;
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
    if (resolved || !isResponseMessage(id, msg)) {
      console.warn("[wheatpaste] Received invalid response message.", msg);
      return;
    }

    unsub();
    resolved = true;

    const { done, data, ok } = msg as Partial<ResponseMessage>;
    if (!ok) {
      throw data;
    }
    if (done) {
      resolve({
        type: RequestResultType.OneShot,
        id,
        data,
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
        type: RequestResultType.Pushing,
        id,
        header: data,
        body: (async function* () {
          while (true) {
            while (messages.length > 0) {
              const { ok, done, data } = messages.shift() ?? {};
              if (!ok) {
                throw data;
              }
              yield data;
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
    data,
  } satisfies RequestMessage);

  return promise;
};
