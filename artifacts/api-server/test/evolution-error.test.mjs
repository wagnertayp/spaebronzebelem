import assert from "node:assert/strict";
import test from "node:test";
import {
  getEvolutionErrorDetails,
  parseEvolutionResponseBody,
} from "../src/lib/evolution-error.ts";

test("extracts provider error code and message while redacting sensitive values", () => {
  const details = getEvolutionErrorDetails({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "API key=private-value; phone 5511999887766",
    },
  });

  assert.equal(details.providerCode, "INTERNAL_SERVER_ERROR");
  assert.match(details.providerMessage ?? "", /API key=\[redacted\]/i);
  assert.doesNotMatch(details.providerMessage ?? "", /private-value|5511999887766/);
});

test("keeps non-JSON provider error bodies available for safe extraction", async () => {
  const body = await parseEvolutionResponseBody(
    new Response("Evolution service unavailable", { status: 500 }),
  );

  assert.deepEqual(getEvolutionErrorDetails(body), {
    providerMessage: "Evolution service unavailable",
  });
});
