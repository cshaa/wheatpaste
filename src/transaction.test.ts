import { describe, test, mock, expect } from "bun:test";
import { ResponseMessage, createRequest } from "./transaction.ts";
import { fn } from "./utils/test.ts";

type ResponseListener = (messge: ResponseMessage) => void;

describe("transaction", () => {
  describe("request", () => {
    test("basic", async () => {
      const postMessage = fn<void, [message: any]>();
      let messageListener: ResponseListener | undefined;
      const onMessage = (f: ResponseListener) => {
        messageListener = f;
        return () => (messageListener = undefined);
      };

      const req = createRequest({
        path: "foo",
        payload: { bar: 42 },
        postMessage,
        onMessage,
      });

      expect(req).toBeInstanceOf(Promise);

      const { id } = postMessage.mock.calls[0][0] ?? {};
      postMessage.assertCalledOnce([
        {
          id,
          path: "foo",
          payload: { bar: 42 },
        },
      ]);

      expect(messageListener).toBeTypeOf("function");

      messageListener!({
        id,
        ok: true,
        done: true,
        payload: { qux: 69 },
      });

      expect(await req).toStrictEqual({
        id,
        path: "foo",
        streaming: false,
        payload: { qux: 69 },
      });
    });

    test("streaming", async () => {
      const postMessage = fn<void, [message: any]>();
      let messageListener: ResponseListener | undefined;
      const onMessage = (f: ResponseListener) => {
        messageListener = f;
        return () => void 0;
      };

      const req = createRequest({
        path: "get-numbers",
        payload: { count: 5 },
        postMessage,
        onMessage,
      });
      const { id } = postMessage.mock.calls[0][0] ?? {};
      postMessage.assertCalledOnce([
        { id, path: "get-numbers", payload: { count: 5 } },
      ]);

      messageListener!({
        id,
        ok: true,
        done: false,
        payload: { hello: "iterator" },
      });

      const res = await req;

      expect(res).toMatchObject({
        id,
        path: "get-numbers",
        streaming: true,
        header: { hello: "iterator" },
      });

      if (!("body" in res)) throw new Error();
      const { body } = res;

      for (let i = 0; i < 5; i++) {
        messageListener!({
          id,
          ok: true,
          done: i === 4,
          payload: { value: i },
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
});
