export interface RequestMessage<T = any> {
  id: bigint | string;
  data: T;
}

export interface ResponseMessage<T = any> {
  id: bigint | string;
  ok: boolean;
  done: boolean;
  data: T;
}

interface RequestResultCommon {
  id: bigint | string;
}
export enum RequestResultType {
  OneShot,
  Pushing,
}

export interface RequestResultOneShot extends RequestResultCommon {
  type: RequestResultType.OneShot;
  data: any;
}
export interface RequestResultPushing extends RequestResultCommon {
  type: RequestResultType.Pushing;
  header: any;
  body: AsyncIterable<any>;
}
export type RequestResult = RequestResultOneShot | RequestResultPushing;

export type Unsubscriber = () => void;
