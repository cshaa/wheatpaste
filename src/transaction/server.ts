import {
  RequestResultType,
  type RequestMessage,
  type RequestResult,
  type RequestResultOneShot,
  type RequestResultPushing,
  type Unsubscriber,
  type ResponseMessage,
} from "../types.ts";

const isRequestMessage = (
  data: any
): data is Partial<RequestMessage> & { id: RequestMessage["id"] } => {
  if (typeof data !== "object" || data === null) return false;
  if (!("id" in data)) return false;
  return true;
};

export const createServer = ({
  handle,
  postMessage,
  onMessage,
}: {
  handle(opts: {
    data: any;
    oneShot(value: any): Omit<RequestResultOneShot, "id">;
    pushing(
      header: any,
      body: AsyncIterable<any>
    ): Omit<RequestResultPushing, "id">;
  }): Omit<RequestResult, "id">;
  postMessage?(message: unknown, transfer?: unknown[]): void;
  onMessage?(listener: (messge: unknown) => void): Unsubscriber;
}): Unsubscriber => {
  postMessage ??= globalThis.postMessage;
  onMessage ??= (listener) => {
    const sub = (ev: MessageEvent) => listener(ev.data);
    globalThis.addEventListener("message", sub);
    return () => globalThis.removeEventListener("message", sub);
  };

  const oneShot = (value: any): Omit<RequestResultOneShot, "id"> => ({
    type: RequestResultType.OneShot,
    data: value,
  });

  const pushing = (
    header: any,
    body: AsyncIterable<any>
  ): Omit<RequestResultPushing, "id"> => ({
    type: RequestResultType.Pushing,
    header,
    body,
  });

  const unsub = onMessage(async (msg) => {
    if (!isRequestMessage(msg)) {
      console.warn("[wheatpaste] Received invalid request message.", msg);
      return;
    }
    const { id, data } = msg;

    try {
      const res = handle({ data, oneShot, pushing }) as RequestResult;
      switch (res.type) {
        case RequestResultType.OneShot: {
          postMessage!({
            id,
            ok: true,
            data: res.data,
            done: true,
          } satisfies ResponseMessage);
          return;
        }
        case RequestResultType.Pushing: {
          postMessage!({
            id,
            ok: true,
            data: res.header,
            done: false,
          });
          for await (const value of res.body) {
            postMessage!({
              id,
              ok: true,
              data: value,
              done: false,
            });
          }
          postMessage!({
            id,
            ok: true,
            data: undefined,
            done: true,
          });
          return;
        }
      }
    } catch (e) {
      postMessage!({
        id,
        ok: false,
        data: e,
        done: true,
      } satisfies ResponseMessage);
    }
  });

  return unsub;
};
