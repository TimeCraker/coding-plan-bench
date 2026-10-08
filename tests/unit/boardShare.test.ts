// wave22 boardShare 单测：buildBoardMarkdown 纯函数——表头/条件行/列序/单位恒定/
// 排序方向跟随指标/空数组守卫/不可比条目过滤/单元格守卫。
import { describe, expect, it } from "vitest";
import type {
  LeaderboardEntryV2,
  RunStatus,
  TransportKind,
} from "../../engine/types";
import { buildBoardMarkdown } from "../../site/src/lib/boardShare";

interface EntryInput {
  id: string;
  label: string;
  ttft: number;
  tps: number | null;
  total: number;
  ranAt?: string;
  transport?: TransportKind;
  status?: RunStatus;
  demo?: true;
}

function makeEntry(input: EntryInput): LeaderboardEntryV2 {
  const status = input.status ?? "complete";
  return {
    schemaVersion: 2,
    id: input.id,
    label: input.label,
    protocol: "anthropic",
    requestUrlDisplay: "https://open.bigmodel.cn/api/anthropic/v1/messages",
    model: input.label.toLowerCase(),
    ranAt: input.ranAt ?? "2026-10-05T08:00:00.000Z",
    rankable: status === "complete" && !input.demo,
    demo: input.demo,
    run: {
      schemaVersion: 2,
      measurementVersion: 1,
      profile: { id: "cpb-standard", version: 1, promptSha256: "x" },
      transport: input.transport ?? "browser-direct",
      status,
      requestedSamples: 1,
      successCount: status === "complete" ? 1 : 0,
      aggregate: {
        ttftMs: input.ttft,
        thinkingMs: null,
        generationMs: 800,
        totalMs: input.total,
        outputTokens: 96,
        inputTokens: 12,
        tps: input.tps,
        tokenSource: input.tps == null ? "unavailable" : "provider",
      },
      samples: [],
    },
  };
}

const legacyEntry: LeaderboardEntryV2 = {
  schemaVersion: 2,
  id: "old-1",
  label: "旧记录",
  protocol: "anthropic",
  requestUrlDisplay: "https://example.com",
  model: "old-model",
  ranAt: "2026-07-01T00:00:00.000Z",
  legacy: true,
  rankable: false,
  legacyMetrics: { ttft: 100, tps: 50, total: 2000, outputTokens: 90, samples: 3 },
};

/** 数据行（剔除表头行与 --- 分隔行） */
function dataRows(md: string): string[] {
  return md
    .split("\n")
    .filter((l) => l.startsWith("| "))
    .filter((l) => !l.startsWith("| # "))
    .filter((l) => !l.includes("---"));
}

/** 取第 n 列单元格（0 起；列 0 是行首空段后的 #） */
function col(row: string, i: number): string {
  return row.split("|")[i + 1].trim();
}

function twoEntries(): LeaderboardEntryV2[] {
  return [
    makeEntry({ id: "a", label: "GLM-5.3", ttft: 312, tps: 45.25, total: 12345 }),
    makeEntry({ id: "b", label: "GLM-5.3-Flash", ttft: 198, tps: 89, total: 8400 }),
  ];
}

describe("表头与条件行", () => {
  it("标题带可比条数；条件行 = profile@version · transport", () => {
    const md = buildBoardMarkdown(twoEntries(), "total");
    expect(md).toContain("# Coding Plan Bench · 本机榜单（2 条）");
    expect(md).toContain("条件：cpb-standard@1 · browser-direct");
    expect(md.endsWith("> 数据仅存本地，测试条件见站内方法学。")).toBe(true);
  });

  it("多条件分组并列展示并标组数", () => {
    const md = buildBoardMarkdown(
      [
        makeEntry({ id: "a", label: "GLM-5.3", ttft: 312, tps: 45, total: 12000 }),
        makeEntry({
          id: "b",
          label: "GLM-5.3",
          ttft: 330,
          tps: 44,
          total: 12500,
          transport: "trusted-proxy",
        }),
      ],
      "total",
    );
    expect(md).toContain("cpb-standard@1 · browser-direct");
    expect(md).toContain("cpb-standard@1 · trusted-proxy");
    expect(md).toContain("（2 组）");
  });
});

describe("列序与单位恒定", () => {
  it("表头列序固定：# | 模型 | TTFT | TPS | Total", () => {
    const md = buildBoardMarkdown(twoEntries(), "total");
    expect(md).toContain("| # | 模型 | TTFT | TPS | Total |");
    expect(dataRows(md)).toHaveLength(2);
  });

  it("TTFT 恒 ms、Total 恒 s、TPS 无单位；缺 TPS 为 —", () => {
    const md = buildBoardMarkdown(
      [...twoEntries(), makeEntry({ id: "c", label: "NoUsage", ttft: 500, tps: null, total: 9999 })],
      "total",
    );
    const rows = dataRows(md);
    for (const r of rows) {
      expect(col(r, 2)).toMatch(/^\d+ms$/);
      const tps = col(r, 3);
      if (tps !== "—") expect(tps).toMatch(/^\d+(\.\d+)?$/);
      expect(col(r, 4)).toMatch(/^\d+\.\d{2}s$/);
    }
    // 按 total 升序：Flash(8400) → NoUsage(9999, 无用量) → GLM-5.3(12345)
    expect(col(rows[1], 1)).toBe("NoUsage");
    expect(col(rows[1], 3)).toBe("—");
    expect(col(rows[2], 1)).toBe("GLM-5.3");
    expect(col(rows[0], 1)).toBe("GLM-5.3-Flash");
  });

  it("模型名含竖线/换行时守卫为安全单元格文本", () => {
    const md = buildBoardMarkdown(
      [makeEntry({ id: "x", label: "A|B\nC", ttft: 100, tps: 10, total: 1000 })],
      "total",
    );
    const row = dataRows(md)[0];
    expect(col(row, 1)).toBe("A/B C");
  });
});

describe("排序方向跟随指标", () => {
  it("total（越低越好）：榜首为 Total 最小条目，名次两位补零", () => {
    const md = buildBoardMarkdown(twoEntries(), "total");
    const rows = dataRows(md);
    expect(col(rows[0], 0)).toBe("01");
    expect(col(rows[0], 1)).toBe("GLM-5.3-Flash");
    expect(col(rows[1], 0)).toBe("02");
  });

  it("tps（越高越好）：榜首为 TPS 最大条目", () => {
    const md = buildBoardMarkdown(twoEntries(), "tps");
    expect(col(dataRows(md)[0], 1)).toBe("GLM-5.3-Flash");
    expect(col(dataRows(md)[0], 3)).toBe("89.0");
  });
});

describe("空数组守卫", () => {
  it("空输入：0 条标题 + 空态语 + 尾行，不产出表格行与条件行", () => {
    const md = buildBoardMarkdown([], "total");
    expect(md).toContain("本机榜单（0 条）");
    expect(md).toContain("还没有可比较的记录。");
    expect(md).toContain("> 数据仅存本地，测试条件见站内方法学。");
    expect(md).not.toContain("| # | 模型");
    expect(md).not.toContain("条件：");
  });
});

describe("不可比条目过滤", () => {
  it("partial / demo / legacy 不进导出，计数只含可比", () => {
    const md = buildBoardMarkdown(
      [
        makeEntry({ id: "ok", label: "OK", ttft: 200, tps: 50, total: 5000 }),
        makeEntry({ id: "p", label: "Partial", ttft: 100, tps: 99, total: 1000, status: "partial" }),
        makeEntry({ id: "d", label: "Demo", ttft: 100, tps: 99, total: 1000, demo: true }),
        legacyEntry,
      ],
      "total",
    );
    expect(md).toContain("本机榜单（1 条）");
    expect(dataRows(md)).toHaveLength(1);
    expect(md).not.toContain("Partial");
    expect(md).not.toContain("旧记录");
  });
});
