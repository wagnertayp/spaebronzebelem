---
name: Financial import dates
description: Keep aggregate customer revenue and inventory expiry reports separate from dated cash-flow movements.
---

Monthly financial movements require the actual transaction, receipt, or expense date. Customer-level lifetime billing totals and product expiration dates are not transaction dates and must not be assigned to a month or expanded into invented movements. Deduplicate only by a reliable transaction identifier or exact duplicate row; repeated names or phone numbers alone are ambiguous.

**Why:** Historical customer aggregates and stock exports cannot establish whether revenue belongs to the current month or a future month, and merging repeated customer identities can erase legitimate records.

**How to apply:** Ask for a dated, one-row-per-transaction export with an invoice/transaction ID before importing monthly cash-flow data. Keep lifetime totals in customer reporting instead.