import test from "node:test";
import assert from "node:assert/strict";
import { matchWhatsappKeywordFlow } from "../src/lib/whatsapp-keyword-flows.ts";

const flows = [
  {
    id: "price",
    name: "Valores",
    keywords: ["preço", "quanto custa"],
    enabled: true,
    message: "Consulte nossos valores.",
    imageUrl: null,
  },
  {
    id: "disabled",
    name: "Desligado",
    keywords: ["bronze"],
    enabled: false,
    message: "Fluxo desativado.",
    imageUrl: null,
  },
];

test("keyword matching ignores accents and case and matches complete phrases", () => {
  assert.equal(matchWhatsappKeywordFlow("Qual o PRECO?", flows)?.id, "price");
  assert.equal(matchWhatsappKeywordFlow("quanto custa hoje", flows)?.id, "price");
});

test("keyword matching does not match partial words or disabled flows", () => {
  assert.equal(matchWhatsappKeywordFlow("apreço", flows), null);
  assert.equal(matchWhatsappKeywordFlow("bronze", flows), null);
});
