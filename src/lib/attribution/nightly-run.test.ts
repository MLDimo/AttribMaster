import type { BigQuery } from "@google-cloud/bigquery";
import { describe, expect, it, vi } from "vitest";

import { daysAgoDateOnly, ensureNestedField, toDateOnly, yesterdayDateOnly } from "./nightly-run";

type Field = { name: string; type: string; mode?: string; fields?: Field[] };

/** Faux client BigQuery réduit à ce que `ensureNestedField` touche : lire puis patcher le schéma d'une table. */
function fakeClient(fields: Field[]) {
  const setMetadata = vi.fn(async (_metadata: { schema: { fields: Field[] } }) => {});
  const getMetadata = vi.fn(async () => [{ schema: { fields } }]);
  const client = {
    dataset: () => ({ table: () => ({ getMetadata, setMetadata }) }),
  } as unknown as BigQuery;
  return { client, setMetadata };
}

const touchpointsField = (children: Field[]): Field[] => [
  { name: "transaction_id", type: "STRING" },
  { name: "touchpoints", type: "RECORD", mode: "REPEATED", fields: children },
];

describe("nightly-run date helpers", () => {
  it("toDateOnly formats a Date as YYYY-MM-DD in UTC", () => {
    expect(toDateOnly(new Date("2026-07-20T23:59:59.000Z"))).toBe("2026-07-20");
    expect(toDateOnly(new Date("2026-07-20T00:00:00.000Z"))).toBe("2026-07-20");
  });

  it("daysAgoDateOnly(0) is today, daysAgoDateOnly(n) is n days before today", () => {
    const today = toDateOnly(new Date());
    expect(daysAgoDateOnly(0)).toBe(today);

    const n = 5;
    const expected = toDateOnly(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
    expect(daysAgoDateOnly(n)).toBe(expected);
  });

  it("yesterdayDateOnly is exactly daysAgoDateOnly(1)", () => {
    expect(yesterdayDateOnly()).toBe(daysAgoDateOnly(1));
  });
});

describe("ensureNestedField", () => {
  it("ajoute le champ manquant en NULLABLE sans toucher aux champs existants", async () => {
    const { client, setMetadata } = fakeClient(
      touchpointsField([
        { name: "source", type: "STRING" },
        { name: "position", type: "INTEGER" },
      ])
    );

    await ensureNestedField(client, "attribution", "attributions_resumees", "touchpoints", {
      name: "entry_url",
      type: "STRING",
    });

    expect(setMetadata).toHaveBeenCalledTimes(1);
    expect(setMetadata.mock.calls[0][0].schema.fields[1].fields).toEqual([
      { name: "source", type: "STRING" },
      { name: "position", type: "INTEGER" },
      { name: "entry_url", type: "STRING", mode: "NULLABLE" },
    ]);
  });

  it("ne patche rien si le champ est déjà là (idempotent, appelé chaque nuit)", async () => {
    const { client, setMetadata } = fakeClient(
      touchpointsField([
        { name: "source", type: "STRING" },
        { name: "entry_url", type: "STRING", mode: "NULLABLE" },
      ])
    );

    await ensureNestedField(client, "attribution", "attributions_resumees", "touchpoints", {
      name: "entry_url",
      type: "STRING",
    });

    expect(setMetadata).not.toHaveBeenCalled();
  });

  it("échoue explicitement si le STRUCT parent n'existe pas", async () => {
    const { client } = fakeClient([{ name: "transaction_id", type: "STRING" }]);

    await expect(
      ensureNestedField(client, "attribution", "attributions_resumees", "touchpoints", {
        name: "entry_url",
        type: "STRING",
      })
    ).rejects.toThrow(/touchpoints/);
  });
});
