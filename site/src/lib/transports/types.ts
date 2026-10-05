// transport 层公共契约：所有 transport 接收同一形状的输入（samples 与 transport 正交），
// 返回 BenchmarkRunResult；progress/AbortSignal 全链路透传。

import type {
  BenchmarkRunResult,
  Protocol,
  SampleResult,
  TransportKind,
} from "../../../../engine/types";
import type { BenchmarkProfile } from "../../../../engine/types";

export interface TransportRequest {
  /** 完整 Request URL（原样发往 provider） */
  requestUrl: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  samples: 1 | 3 | 5;
  profile: BenchmarkProfile;
  signal?: AbortSignal;
  onProgress?: (info: { index: number; total: number; sample: SampleResult }) => void;
}

export interface Transport {
  kind: TransportKind;
  run(req: TransportRequest): Promise<BenchmarkRunResult>;
}
