import { describe, test, expect } from "bun:test";
import { fn } from "../utils/test.ts";

import { createRequest } from "./request.ts";
import { RequestResultType, ResponseMessage } from "../types.ts";

type ResponseListener = (messge: ResponseMessage) => void;

describe("request", () => {
  test("one-shot", async () => {
    const postMessage = fn<void, [message: any]>();
    let messageListener: ResponseListener | undefined;
    const onMessage = (f: ResponseListener) => {
      messageListener = f;
      return () => (messageListener = undefined);
    };

    const req = createRequest({
      data: { bar: 42 },
      postMessage,
      onMessage,
    });

    expect(req).toBeInstanceOf(Promise);

    const { id } = postMessage.mock.calls[0][0] ?? {};
    postMessage.assertCalledOnce([{ id, payload: { bar: 42 } }]);

    expect(messageListener).toBeTypeOf("function");

    messageListener!({
      id,
      ok: true,
      done: true,
      data: { qux: 69 },
    });

    expect(await req).toStrictEqual({
      type: RequestResultType.OneShot,
      id,
      data: { qux: 69 },
    });
  });

  test("pushing", async () => {
    const postMessage = fn<void, [message: any]>();
    let messageListener: ResponseListener | undefined;
    const onMessage = (f: ResponseListener) => {
      messageListener = f;
      return () => void 0;
    };

    const req = createRequest({
      data: { count: 5 },
      postMessage,
      onMessage,
    });
    const { id } = postMessage.mock.calls[0][0] ?? {};
    postMessage.assertCalledOnce([{ id, payload: { count: 5 } }]);

    messageListener!({
      id,
      ok: true,
      done: false,
      data: { hello: "iterator" },
    });

    const res = await req;

    expect(res).toMatchObject({
      type: RequestResultType.Pushing,
      id,
      path: "get-numbers",
      header: { hello: "iterator" },
    });

    if (!("body" in res)) throw new Error();
    const { body } = res;

    for (let i = 0; i < 5; i++) {
      messageListener!({
        id,
        ok: true,
        done: i === 4,
        data: { value: i },
      });
    }

    let arr: any[] = [];
    for await (const x of body) arr.push(x);

    expect(arr).toStrictEqual([
      { value: 0 },
      { value: 1 },
      { value: 2 },
      { value: 3 },
      { value: 4 },
    ]);
  });
});
