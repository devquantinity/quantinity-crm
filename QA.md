# Quantinity CRM — test script

For a tester who has never seen this app. No keyboard shortcuts anywhere.

Everything is done with the mouse. Where a step says **click X**, X is a button
on the grey action bar across the top of a record, next to the record's name.
If you cannot see it, click the **…** button at the right end of that bar — the
less common actions live there.

Work through the sections in order. Section D depends on what you made in A.

---

## Before you start

1. Open Chrome and go to **http://localhost:2020**
2. Sign in.
3. Check these pages all load. There are no sidebar links for them yet, so type
   the address in:

   - http://localhost:2020/objects/quotes
   - http://localhost:2020/objects/invoices
   - http://localhost:2020/objects/projects
   - http://localhost:2020/objects/milestones
   - http://localhost:2020/objects/products

**Report a problem if:** any page shows an error, or spins for more than about
ten seconds.

Note the two numbers you start from: open **Settings → Billing** and write down
"Next quotation will be…" and "Next invoice will be…". You will check these
later.

---

## A. Make a quotation

| # | Do this | Should happen |
|---|---|---|
| A1 | Go to http://localhost:2020/objects/opportunities and open any deal that has a company on it | The deal's page opens |
| A2 | Scroll down to the **Quotes** section and click **+** | A new empty quotation is created and opens |
| A3 | Click **Add items from catalogue** on the action bar | A panel opens listing products |
| A4 | Tick two products, set a quantity on each, click **Add** | Two lines appear on the quotation with the right quantities |
| A5 | Click **Add items from catalogue** again | The panel opens with **nothing ticked** |
| A6 | Close the panel without adding | No extra lines were added |

**Report a problem if:** the ticks are still on at A5, or adding puts the same
line on twice.

---

## B. Issue it

| # | Do this | Should happen |
|---|---|---|
| B1 | On that quotation, click **Issue quotation** | A confirmation panel opens |
| B2 | Confirm | Status becomes ISSUED, a number appears (Q-00xx), and a message says the client link was copied |
| B3 | Open a new browser tab and paste | A clean client-facing quotation page opens |
| B4 | Read the page | "Bill to" is filled in with the client's name and address — **not empty** |
| B5 | Go back and try to change a line on the issued quotation | It should refuse or be read-only |
| B6 | Click **Issue quotation** again | Refused, with a message saying it is already issued |

**Report a problem if:** "Bill to" is empty, the link shows an error or raw
code like `{"statusCode":500…}`, or issuing twice gives it a second number.

---

## C. Refusals — these are supposed to fail

Each of these must be **refused with a readable sentence**, never a crash, a
blank screen, or raw code.

| # | Do this | Should happen |
|---|---|---|
| C1 | Make a new quotation with no lines at all, click **Issue quotation** | Refused: nothing to issue |
| C2 | Make a new quotation, add a line but leave its description and name empty, issue it | Refused: the line has no description |
| C3 | Make a new quotation **not linked to any deal**, issue it | Refused: nobody to bill |
| C4 | After C3, open **Settings → Billing** and read "Next quotation will be…" | **The number has not moved.** A refused quotation must not use up a number |
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
| E1 | On that deal, click **Start project** | A project is created |
| E2 | Open the project | It has one milestone per line of the accepted quotation, same order, same amounts |
| E3 | Go back to the deal and click **Start project** again | Refused — one project per deal |

---

## F. Invoice and payment

| # | Do this | Should happen |
|---|---|---|
| F1 | Open a milestone on that project, click **Bill this milestone** | A draft invoice is created for that milestone's amount |
| F2 | Click **Bill this milestone** again | Refused — there is already a draft |
| F3 | Open the draft invoice, click **Issue invoice** | It gets a number (INV-00xx), a due date, and the client link is copied |
| F4 | Paste the link in a new tab | A clean invoice page with "Bill to", the amount due, and how to pay |
| F5 | Back in the app, click **…** then **Mark invoice paid** | Status becomes PAID |
| F6 | Click **…** then **Mark invoice paid** again | Refused, and it tells you the date it was already paid |
| F7 | Reload the client link from F4 | It no longer asks for money |
| F8 | Open the milestone that invoice came from | Still not marked delivered — paid and delivered are separate on purpose |

---

## G. Numbering

| # | Do this | Should happen |
|---|---|---|
| G1 | **Settings → Billing**, set "Next quotation" to a **higher** number, save | Saves. Skipping ahead is allowed |
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
