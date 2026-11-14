# Program Jerseys live in a standalone, non-seasonal workbook, tracked by size, with loans as the history

Program Jerseys outlive a season, but every other piece of coach data lives in a per-season coach workbook. We decided to keep jersey data in its own Jerseys workbook that is never rolled over, keyed by PlayerID, with four tabs: Jersey Loans (one row per loan, never deleted, so the tab is itself the history of where jerseys have been), Jersey Stock (Total Owned per size; On Hand is computed as Total Owned minus open and Lost loans), Family Jerseys (which Players own one, to size future orders), and Jersey Notes (free-form Jersey Manager observations). A README tab in the workbook explains how to edit it by hand.

## Considered Options

- **Tabs in each season's coach workbook.** Rejected: open loans and stock counts would have to be carried forward by hand every season, and a loan that spans a rollover would be split across two workbooks.
- **Per-jersey IDs (numbered or labeled jerseys).** Rejected: the jerseys aren't labeled, and the questions that matter ("who still has one of ours", "how many of each size are on the shelf") are answered by size alone.
- **An append-only event log (one row per check-out or check-in event).** Rejected: every read would replay events, and it's much harder to read or hand-fix in a sheet than one row per loan.

## Consequences

- An unattributed returned jersey can't be checked in; it must be matched to a Player first, or On Hand and the open-loan list would disagree.
- Shelf-count discrepancies are fixed by editing Total Owned with a note, not by inventing loans.
