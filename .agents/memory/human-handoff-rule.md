---
name: Human handoff rule
description: Product decision for when WhatsApp conversations leave the AI agent.
---

The AI should transfer a WhatsApp conversation to a human when the client explicitly asks for an attendant, person, or human service. Questions about Spa Infantil are an exception: confirm that it exists and transfer to an attendant. Complaints, negotiations, rescheduling, clinical limits, and other missing information stay in the AI conversation.

**Why:** The desired experience is continuous, friendly AI assistance rather than automatic escalation whenever a topic is difficult or negative. The user clarified that Spa Infantil is offered and requested a human handoff for those inquiries.

**How to apply:** Keep general handoff detection limited to explicit human-request language. Detect Spa Infantil questions separately, confirm the service, and set the conversation to human handling. Manual operator actions remain allowed, but model handoff flags must not override this rule.