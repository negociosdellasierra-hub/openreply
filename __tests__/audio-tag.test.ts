import { describe, expect, it } from "vitest";
import { extractAudioTag } from "@/lib/utils/audio-tag";

describe("extractAudioTag", () => {
  it("leaves messages without a tag untouched", () => {
    expect(extractAudioTag("hola")).toEqual({ audioUrl: null, text: "hola" });
  });
  it("extracts a leading audio tag and keeps the text", () => {
    expect(
      extractAudioTag("[audio:https://proyectoatom.lat/a.m4a]\n¿Qué te frena? 👇")
    ).toEqual({
      audioUrl: "https://proyectoatom.lat/a.m4a",
      text: "¿Qué te frena? 👇",
    });
  });
  it("supports an audio-only message", () => {
    expect(extractAudioTag("[audio:https://x.co/a.m4a]")).toEqual({
      audioUrl: "https://x.co/a.m4a",
      text: "",
    });
  });
  it("ignores non-https urls", () => {
    expect(extractAudioTag("[audio:http://x.co/a.m4a] hi").audioUrl).toBeNull();
  });
});
