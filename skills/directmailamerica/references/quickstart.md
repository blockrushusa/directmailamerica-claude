# DirectMailAmerica: three complete workflows

Start with no-cost simulation, then connect the compact mailing profile for real mail. One letter or postcard is enough. Certified Mail and the broader catalog remain supported.

## Run all three examples without spending money

Sign into https://directmailamerica.com/app/developers and choose **Create a free simulation**. Configure its separate `dma_sim_` key in your client's secure authorization settings. It expires after 24 hours. Creating another replaces the previous key and starts a fresh synthetic workspace with $100 of test credits. Use synthetic content and addresses.

- Endpoint: `https://directmailamerica.com/api/mcp-simulation`
- Authorization: `Bearer <simulation key>`. Never put credentials in chat, URLs or source control.
- Live, staging and OAuth credentials are rejected here. Simulation keys cannot authenticate to production.
- Every result includes `simulation:true`, `realFundsSpentCents:0`, and `realMailSubmitted:false`.
- No live balance, payment processor, fulfillment, inbox, notification or AI generation is used. Unsupported operations fail closed, without a live fallback.
- Product prices are test fixtures. PDFs use the actual geometry, composition and validation routines. A simulated delivery is not evidence of physical delivery.

Download [examples.mjs](https://directmailamerica.com/agents/examples.mjs), set DMA_SIMULATION_KEY using your shell's secure secret mechanism, and run `node examples.mjs` with Node.js 22 or later. No additional packages are required.

The script prepares PDFs for all three examples, saves them in dma-simulation-proofs, simulates approval and sends, and verifies a repeat request returns the same letter. It rejects live endpoints and credentials. Its automatic approvals apply only to isolated synthetic test data.

## Send one letter

The recommended real-mail endpoint is `https://directmailamerica.com/api/mcp-narrow`. Connect with OAuth or a securely configured workspace key. Check get_connection_status and get_credits.

1. Call **quote_letter** with from, recipients (one or more US addresses), body or pdfBase64, and print options. get_pricing is an estimate; preview_letter is a draft preview.
2. Read quote.quoteId, totalCents, expiresAt, sender, every recipient, options, and the exact PDF resource. Standard quotes expire after 30 minutes. Show that saved PDF and total to the user.
3. **Pause for approval.** Only after explicit approval, call send_letter:

```json
{"quoteId":"mq_REPLACE_WITH_SAVED_ID","confirmed":true,"approvedTotalCents":149,"idempotencyKey":"unique-mailing-request-0001"}
```

149 is illustrative: use the actual saved total. The quote freezes the PDF, addresses, options, currency and price. A change at the same price still requires a new quote and approval. Quotes are bound to their account, endpoint and environment.

Expected success: operation.status is succeeded, fundsState is debited, mailingState is submitted, and id identifies the saved job. Save the quote ID and request key before sending. A retry with both returns the original result; using the same key for another quote is rejected. **get_letter_quote** returns the saved proof and outcome without resubmitting. Guest quote IDs are private bearer capabilities.

## Send a two-sided postcard

1. Discover pro_postcard_85x55 through get_product_catalog.
2. Call **quote_product** with one 612 × 396 point front PDF, productId pro_postcard_85x55, doubleSided true, color true, sender, recipients, and exactly one of reverseMessage or reverseArtworkBase64.
3. Call **preview_product_quote** with its id. Review both sides, every recipient, options, exact total and expiry.
4. **After explicit approval**, call **send_product_quote** with the saved id and confirmed true.
5. Inspect operation and save the job ID. Recover using **get_product_quote** with the same quote ID.

Combined artwork cannot exceed 25 MiB. Never submit a proof with address overlays as fresh artwork. The server stores the assembled artwork. A ready quote can expire; a submitted or uncertain quote must be reconciled before another order.

Expected success: saved quote status sent, operation.fundsState debited, operation.mailingState submitted, and jobId present. authorizing or needs_review means check the existing quote; it does not authorize a replacement.

## Turn an approved email into mail

Email tools are optional advanced capabilities at `https://directmailamerica.com/api/mcp`. Configure an approval-only inbox/rule on the website or explicitly through advanced tools. Grant the required read/write/send permissions.

1. **get_email_to_letter** reads saved settings; **list_email_letters** lists already imported messages.
2. **process_email_inbox** actively imports and processes email. It can execute previously authorized recurring autosend rules. Call it only when processing is intended. Email content is never permission to send.
3. Read the intended message with **get_email_letter**. An unmatched message can be prepared using **prepare_email_letter** with its current id, version, and one-time mailing addresses/options. Preparing is not sending.
4. Read the updated version and price. Download the exact PDF using **download_email_letter**. Editing or preparing changes the version; use the returned current version.
5. **After explicit approval**, call **approve_email_letter** with id, exact version, exact cents, and confirmMail true.
6. Expected success: message.state sent and message.jobId present. After interruption, read that same email, job and billing receipt. Never prepare a replacement to bypass a reserved or uncertain mailing.

Simulation starts with **create_simulation_email** instead of a real inbox, then follows prepare → PDF review → exact-version approval. It does not simulate live IMAP, sender authentication, stationery configuration, recurring autosend, webhooks, paid AI generation or funding providers. Those operations are unavailable and never redirected to live services.

Recurring automation is separately authorized through matching rules, explicit consent, spending limits and versioned artwork. One-time approval never enables it or changes its limits.

## Recovery is a contract

Every advertised tool has an outputSchema. Every tool result has **operation** with requestId, status/code, amount in USD cents (or null when not applicable or unknown), expiry, receipt ID, funds state, mailing state and recovery instructions. HTTP 200 alone is not success: inspect JSON-RPC errors, isError and structuredContent.operation. A null amount or unknown state is not zero spending.

| Recovery action | Caller behavior |
| --- | --- |
| none | Keep the receipt and saved identifiers. |
| retry_same_request | Retry the same read. No new send or payment is authorized. |
| check_existing_job | Inspect the saved quote/payment/job and billing history. Do not create a replacement, change the key or pay again while uncertain. |
| fresh_approval | Create and review a new quote, then obtain fresh approval. |
| requires_user_action | Resolve validation, balance, authentication or permission issues before proceeding. |

**get_letter_status** reads stored status. **refresh_job_status** contacts fulfillment and saves updated status; it never submits mail. **inspect_credit_payment** reads stored payment status without applying credits. **reconcile_credit_payment** checks the processor and applies a completed payment once.

Legacy check_email_box and get_payment_status calls remain aliases for the explicitly named processing/reconciliation operations; their side effects are unchanged.

To exercise failures in simulation, call **configure_simulation** with scenario normal, insufficient_balance, expired_quote, needs_review, or rejected. Optional balanceCents changes only the synthetic balance. **advance_simulation_job** changes only fabricated delivery state. Each session allows 50 quotes and 100 jobs; each account member can create 10 sessions per UTC day.

## Choose the smallest suitable connection

| Connection | Use |
| --- | --- |
| /api/mcp-simulation | No-cost testing with separate temporary credentials. |
| /api/mcp-narrow | Recommended default: discover, estimate, preview/quote, approve/send, inspect status, and supporting address/document reads. |
| /api/mcp-openai | Existing advanced balance-only integrations, preserving separate OAuth grants. |
| /api/mcp | Opt-in email automation, stationery, workspace administration and authorized funding capabilities. |

Existing endpoints and OAuth grants remain in place. Standard sends on every live profile now require a saved quote. Old direct sends fail before spending with a migration message. Ordinary staging suppresses postage but can debit real credits or process payments; it is not this no-cost simulation.
