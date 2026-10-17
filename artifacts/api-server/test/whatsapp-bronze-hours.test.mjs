import assert from "node:assert/strict";
import test from "node:test";
import {
  bronzeAudioUnavailableReply,
  bronzeMethodDifferenceReply,
  bronzeTextFallbackReply,
} from "../src/lib/whatsapp-bronze.ts";

test("all bronze replies distinguish weekday, Saturday, and Sunday closing times", () => {
  for (const reply of [
    bronzeMethodDifferenceReply,
    bronzeAudioUnavailableReply,
    bronzeTextFallbackReply,
  ]) {
    assert.match(reply, /20h de segunda a sexta/);
    assert.match(reply, /18h no sábado/);
    assert.match(reply, /11h30 no domingo/);
    assert.doesNotMatch(reply, /20h de segunda a sexta e 18h aos sábados/);
  }
});
