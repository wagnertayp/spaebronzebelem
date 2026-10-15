import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingFitsScheduleIntervals,
  canUseWhatsappBookingUpdate,
  formatWhatsappBookingSlotChoices,
  getWhatsappBookingMessageSignals,
  hasWhatsappBookingIntent,
  isWhatsappBookingPrompt,
  isWhatsappCatalogOffer,
  isWhatsappCatalogRequest,
  isWhatsappTopicChange,
  mergeWhatsappBookingDraft,
  normalizeLocalBookingDate,
  normalizeLocalBookingTime,
  shouldSuppressStaleWhatsappBookingContext,
} from "../src/lib/whatsapp-booking.ts";

test("offers distinct times without exposing professional names", () => {
  const choices = formatWhatsappBookingSlotChoices([
    { time: "07:30", professional: "Gabriela Silva" },
    { time: "08:00", professional: "Gabriela Silva" },
    { time: "08:00", professional: "Paula Costa" },
    { time: "08:30", professional: "Gabriela Silva" },
    { time: "09:00", professional: "Paula Costa" },
  ], (time) => time);

  assert.equal(choices, "07:30, 08:00, 08:30, 09:00");
  assert.doesNotMatch(choices, /Gabriela|Paula/);
});

test("recognizes a direct request for appointment availability", () => {
  assert.equal(hasWhatsappBookingIntent("Sugeriram segunda mas preciso saber os horários?"), true);
  assert.equal(hasWhatsappBookingIntent("Vocês fazem drenagem?"), false);
});

test("catalog browsing and changing subjects are not booking requests", () => {
  assert.equal(isWhatsappCatalogRequest("O catálogo de estética avançada pra dar uma olhada"), true);
  assert.equal(isWhatsappTopicChange("Mas agora eu queria outra coisa"), true);
  assert.equal(isWhatsappCatalogOffer("Posso te enviar o catálogo de estética avançada?"), true);
  assert.equal(isWhatsappBookingPrompt("Qual dia você prefere para agendar?"), true);
  assert.equal(isWhatsappBookingPrompt("Segue o catálogo de estética avançada."), false);
});

test("a catalog request, accepted catalog offer, or topic change suppresses stale booking context", () => {
  for (const context of [
    { catalogRequest: true },
    { acceptedCatalogOffer: true },
    { topicChange: true },
    { modelSelectedDocument: true },
  ]) {
    assert.equal(shouldSuppressStaleWhatsappBookingContext({
      explicitBookingIntent: false,
      catalogRequest: false,
      acceptedCatalogOffer: false,
      topicChange: false,
      modelSelectedDocument: false,
      ...context,
    }), true);
  }

  assert.equal(shouldSuppressStaleWhatsappBookingContext({
    explicitBookingIntent: true,
    catalogRequest: true,
    acceptedCatalogOffer: false,
    topicChange: false,
    modelSelectedDocument: true,
  }), false);
});

test("a model booking update is ignored unless the current turn is in an active booking flow", () => {
  assert.equal(canUseWhatsappBookingUpdate({
    suppressed: true,
    directBookingIntent: false,
    savedDraftHasRelevantInput: true,
    hasRecentBookingContext: true,
  }), false);
  assert.equal(canUseWhatsappBookingUpdate({
    suppressed: false,
    directBookingIntent: true,
    savedDraftHasRelevantInput: false,
    hasRecentBookingContext: false,
  }), true);
});

test("resolve relative dates in the configured local calendar", () => {
  assert.equal(normalizeLocalBookingDate("amanhã", "2026-10-03"), "2026-10-04");
  assert.equal(
    normalizeLocalBookingDate("Ela disse que pode amanhã", "2026-10-03"),
    "2026-10-04",
  );
  assert.equal(normalizeLocalBookingDate("sexta-feira", "2026-10-03"), "2026-10-09");
  assert.equal(normalizeLocalBookingDate("16/10/2026", "2026-10-03"), "2026-10-16");
  assert.equal(
    normalizeLocalBookingDate("Sugeriram segunda mas preciso saber os horários?", "2026-10-03"),
    "2026-10-05",
  );
});

test("normalizes common Portuguese time choices without treating a date as a time", () => {
  assert.equal(normalizeLocalBookingTime("às 10h30"), "10:30");
  assert.equal(normalizeLocalBookingTime("13:00"), "13:00");
  assert.equal(normalizeLocalBookingTime("13:30"), "13:30");
  assert.equal(normalizeLocalBookingTime("10"), "10:00");
  assert.equal(normalizeLocalBookingTime("meio-dia"), "12:00");
  assert.equal(normalizeLocalBookingTime("dia 10"), null);
});

test("validates an exact requested start time against the full schedule interval", () => {
  const workday = [{ start: "09:00", end: "17:00" }];
  const splitShift = [
    { start: "09:00", end: "12:00" },
    { start: "14:00", end: "17:00" },
  ];
  assert.equal(
    bookingFitsScheduleIntervals("2026-10-03T13:00", "2026-10-03T13:30", workday),
    true,
  );
  assert.equal(
    bookingFitsScheduleIntervals("2026-10-03T13:30", "2026-10-03T14:10", workday),
    true,
  );
  assert.equal(
    bookingFitsScheduleIntervals("2026-10-03T13:30", "2026-10-03T14:10", splitShift),
    false,
  );
  assert.equal(
    bookingFitsScheduleIntervals("2026-10-03T16:30", "2026-10-03T17:30", workday),
    false,
  );
});

test("a chosen offered time completes the saved draft without losing earlier fields", () => {
  const previous = {
    service: "Depilação de axilas",
    date: "2026-10-04",
    time: null,
    professional: null,
    wantsBooking: true,
    awaitingSlotChoice: true,
    awaitingConfirmation: false,
    awaitingClientName: false,
  };
  const signals = getWhatsappBookingMessageSignals("10h", "2026-10-03");
  const merged = mergeWhatsappBookingDraft(
    previous,
    {
      service: null,
      date: null,
      time: null,
      professional: null,
      wantsBooking: false,
      cancelled: false,
    },
    "10h",
    signals,
    "2026-10-03",
    (value) => value === "Depilação de axilas" ? value : null,
  );

  assert.deepEqual(merged, {
    ...previous,
    time: "10:00",
    wantsBooking: true,
    awaitingSlotChoice: false,
  });
});

test("changing the date clears the previously chosen time and professional", () => {
  const previous = {
    service: "Massagem Relaxante",
    date: "2026-10-04",
    time: "10:00",
    professional: "Marina",
    wantsBooking: true,
    awaitingSlotChoice: false,
    awaitingConfirmation: false,
    awaitingClientName: false,
  };
  const signals = getWhatsappBookingMessageSignals("segunda-feira", "2026-10-03");
  const merged = mergeWhatsappBookingDraft(
    previous,
    {
      service: null,
      date: "2026-10-05",
      time: null,
      professional: null,
      wantsBooking: false,
      cancelled: false,
    },
    "segunda-feira",
    signals,
    "2026-10-03",
    (value) => value === "Massagem Relaxante" ? value : null,
  );

  assert.equal(merged?.date, "2026-10-05");
  assert.equal(merged?.time, null);
  assert.equal(merged?.professional, null);
  assert.equal(merged?.wantsBooking, true);
});

test("a confirmation completes a draft awaiting confirmation without asking again", () => {
  const previous = {
    service: "Massagem Relaxante",
    date: "2026-10-04",
    time: "10:00",
    professional: "Marina",
    wantsBooking: false,
    awaitingSlotChoice: false,
    awaitingConfirmation: true,
    awaitingClientName: false,
  };
  const signals = getWhatsappBookingMessageSignals("Sim, por favor", "2026-10-03");
  const merged = mergeWhatsappBookingDraft(
    previous,
    {
      service: null,
      date: null,
      time: null,
      professional: null,
      wantsBooking: false,
      cancelled: false,
    },
    "Sim, por favor",
    signals,
    "2026-10-03",
    (value) => value === "Massagem Relaxante" ? value : null,
  );

  assert.equal(merged?.wantsBooking, true);
  assert.equal(merged?.service, previous.service);
  assert.equal(merged?.date, previous.date);
  assert.equal(merged?.time, previous.time);
  assert.equal(merged?.awaitingConfirmation, false);
});