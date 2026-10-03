---
name: Human handoff rule
description: Product decision for when WhatsApp conversations leave the AI agent.
---

The AI should transfer a WhatsApp conversation to a human when the client explicitly asks for an attendant, person, or human service. Questions about Spa Infantil are an exception: explain the confirmed service details, then transfer to an attendant. The user says it is a bath based on moisturizer and sugar, without lead or ammonia, for children ages 2–10. Complaints, negotiations, rescheduling, clinical limits, and other missing information stay in the AI conversation.

**Why:** The desired experience is continuous, friendly AI assistance rather than automatic escalation whenever a topic is difficult or negative. The user clarified that Spa Infantil is offered, supplied its details, and requested a human handoff after explaining it. Avoid saying it contains no chemicals at all; moisturizer and sugar are chemical substances, so that absolute claim would mislead.

**How to apply:** Keep general handoff detection limited to explicit human-request language. Detect Spa Infantil questions separately, explain only the confirmed details, send that reply, then set the conversation to human handling. Manual operator actions remain allowed, but model handoff flags must not override this rule.