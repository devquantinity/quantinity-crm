# Quantinity CRM — test script

For a tester who has never seen this app. No keyboard shortcuts anywhere.

Everything is done with the mouse. Where a step says **click X**, X is a button
on the grey action bar across the top of a record, next to the record's name.
If you cannot see it, click the **…** button at the right end of that bar — the
less common actions live there.

Work through the sections in order. Section D depends on what you made in A.

---

## Before you start

**The address for this round of testing is `https://internal.crm.quantinity.com`.**
If you are told to test a different workspace, swap the first part of the address
everywhere below - the rest of each address stays the same.

1. Open Chrome and go to **https://internal.crm.quantinity.com**
2. Sign in.
2b. Check the catalogue has products: **Products** in the sidebar. There should
   be at least two with a unit price. If it is empty, add two: **New**, then give
   each a name, a description, a unit and a price. Step A4 needs them.
3. Check these pages all load. There are no sidebar links for them yet, so type
   the address in:

   - https://internal.crm.quantinity.com/objects/quotes
   - https://internal.crm.quantinity.com/objects/invoices
   - https://internal.crm.quantinity.com/objects/projects
   - https://internal.crm.quantinity.com/objects/milestones
   - https://internal.crm.quantinity.com/objects/products

**Report a problem if:** any page shows an error, or spins for more than about
ten seconds.

Note the two numbers you start from: click **Quantinity CRM** at the top of the
sidebar, open the **Billing** tab, and write down "Next quotation will be…" and
"Next invoice will be…". You will check these later.

(Billing is a tab inside the app, not in Twenty's own Settings.)

---

## A. Make a quotation

| # | Do this | Should happen |
|---|---|---|
| A1 | Go to https://internal.crm.quantinity.com/objects/quotes and click **Add a Quote** (or **New** at the top right) | A new empty quotation is created and opens |
| A2 | In the fields list on the left, click the **Opportunity** field and pick a deal that has a company on it | The deal's name appears in the field. Without this the quotation has nobody to bill |
| A3 | Click **Add items** on the action bar | A panel opens listing products, grouped by category. If it is empty, create two products first: **Products** in the sidebar → New |
| A4 | Tick two products, set a quantity on each, click **Add** | Two lines appear on the quotation with the right quantities |
| A5 | Click **Add items** again | The panel opens with **nothing ticked** |
| A6 | Close the panel with the **×** at its top right | No extra lines were added |

**Report a problem if:** the ticks are still on at A5, or adding puts the same
line on twice.

---

## B. Issue it

| # | Do this | Should happen |
|---|---|---|
| B1 | On that quotation, click **Issue** | A confirmation panel opens asking "Issue this quotation?" |
| B2 | Click **Issue** in the panel | Status becomes ISSUED, a number appears (Q-00xx), the record is renamed to that number, and a valid-until date is filled in |
| B3 | Copy the **Share token** from the fields list, open a new tab and go to `https://internal.crm.quantinity.com/s/quote?token=` followed by it | A clean client-facing quotation page opens |
| B4 | Read the page | "Bill to" is filled in with the client's name and address — **not empty** |
| B5 | Go back and try to change a line on the issued quotation | It should refuse or be read-only |
| B6 | Click **Issue** again | Refused, with a message saying it is already issued |

**Report a problem if:** "Bill to" is empty, the link shows an error or raw
code like `{"statusCode":500…}`, or issuing twice gives it a second number.

---

## C. Refusals — these are supposed to fail

Each of these must be **refused with a readable sentence**, never a crash, a
blank screen, or raw code.

| # | Do this | Should happen |
|---|---|---|
| C1 | Make a new quotation with no lines at all, click **Issue** | Refused: nothing to issue |
| C2 | Make a new quotation, add a line but leave its description and name empty, issue it | Refused: the line has no description |
| C3 | Make a new quotation **not linked to any deal**, issue it | Refused: nobody to bill |
| C4 | After C3, open **Quantinity CRM → Billing** and read "Next quotation will be…" | **The number has not moved.** A refused quotation must not use up a number |
| C5 | Open an issued quotation, click **…** then **Withdraw quotation** | Status becomes WITHDRAWN |
| C6 | Open the client link for that withdrawn quotation | It shows as withdrawn and cannot be accepted |

**C4 is the important one.** If the number moved, stop and report it.

---

## D. The client accepts

| # | Do this | Should happen |
|---|---|---|
| D1 | Open the client link from B3 | The quotation page opens with an Accept control |
| D2 | Enter a name and accept | The page confirms acceptance |
| D3 | Go back to the app and reload the quotation | Status is ACCEPTED, with the name that accepted it |
| D4 | Open the deal it belongs to | The deal's amount matches the quotation total |
| D5 | Open the client link again and try to accept a second time | It should not accept twice |

---

## E. Project and milestones

| # | Do this | Should happen |
|---|---|---|
| E1 | Open the deal the quotation belongs to and click **Project** on the action bar, then **Start project** | A project is created and opens |
| E2 | Open the project | It has one milestone per line of the accepted quotation, same order, same amounts |
| E3 | Go back to the deal and click **Project** again | Refused — one project per deal |

---

## F. Invoice and payment

| # | Do this | Should happen |
|---|---|---|
| F1 | Open a milestone on that project, click **Bill** on the action bar, then **Draft invoice** | A draft invoice is created for that milestone's amount and opens |
| F2 | Go back to the milestone and click **Bill** again | Refused — there is already a draft |
| F3 | On the draft invoice, click **Issue** | It gets a number (INV-00xx) and a due date |
| F4 | Open `https://internal.crm.quantinity.com/s/invoice?token=` followed by its **Share token** | A clean invoice page with "Bill to", the amount due, and how to pay |
| F5 | Back in the app, click **…** then **Mark invoice paid** | Status becomes PAID |
| F6 | Click **…** then **Mark invoice paid** again | Refused, and it tells you the date it was already paid |
| F7 | Reload the client link from F4 | It no longer asks for money |
| F8 | Open the milestone that invoice came from | Still not marked delivered — paid and delivered are separate on purpose |

---

## G. Numbering

| # | Do this | Should happen |
|---|---|---|
| G1 | **Quantinity CRM → Billing**, set "Next quotation" to a **higher** number, save | Saves. Skipping ahead is allowed |
| G2 | Set it to a **lower** number, save | Refused, and the message names the highest number already in use |

---

## H. WhatsApp inbox

The inbox reads, but nothing will arrive until the webhook is connected to a
public address. Test what is visible only.

| # | Do this | Should happen |
|---|---|---|
| H1 | Open the Conversations link in the sidebar | The inbox opens without an error |
| H2 | Open a conversation | Messages are grouped by day, newest at the bottom |
| H3 | Open a contact and click **Message on WhatsApp** | A chat panel opens |
| H4 | Send a message | It appears in the thread. Delivery status may stay QUEUED — that is expected until the transport is connected |

---

## How to report

For anything that fails, write down:

1. Which step number
2. What you expected, from the table
3. What actually happened — copy the exact wording of any error
4. A screenshot
5. The record's name or number (for example Q-0054) and the page address

A crash, a blank page, or raw code on any client-facing link is the most
serious kind of finding here — those pages get sent to real clients.

---

## Known, not bugs

- **No sidebar links** for Quotes, Invoices, Projects or Milestones. Type the
  address.
- **No tax on invoices.** Correct for now — the business is not SST registered.
- **A withdrawn quotation keeps its number.** The number stays used up. That is
  deliberate.
- **The company list is full of names like Google and Microsoft.** That is
  Twenty's demo data, not real records.
