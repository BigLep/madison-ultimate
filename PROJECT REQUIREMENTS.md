## Background
I am the coach and admin of the Madison Middle School ultimate frisbee team.  We have between 50-100 players in 6th to 8th grade.  I need to develop some tooling to help caregivers/parents and me things like the current status of players in their signup flow (it's a multiple step process), whether players are available for practices/games, etc.  I'll list more detailed requirements down below and with time.  Historically in seasons past I managed all of this with shared google spreadsheets, but I want to have a more tailored and customized experience because caregivers would get lost in the spreadsheets.

You can get more context on this season from https://docs.google.com/document/d/1A2F7ThHtcMm23bxk8-30rMT2svaqT3gMbRWeSR_QXXY/view

I need your help to design and implement this web application.  I am experienced at software engineering, but I am not proficient and banging out a web application on my own.

## Terminology
Lets call this the "Madison Ultimate App".
I will use "player" and "student" interchangeably.
I will use "parent" and "caretaker" interchangeably.

## Requirements
### General
Must be accessible from a public URL.  Ideally this should be easy and free.  I assume Vercel should be used.
Must be mobile friendly, but it's also good if it works on a desktop as well.
Must use conventional commits.
Must allow for quick/local development.  I assume this means have a local npm server in development mode.
Should periodically document the architecture and design decisions.
Should take advantage of modern web frameworks but not be overly complex.  I assume that means using React or Next.js but I am open to options.
Should have a PLAN.md file where we track the open tasks and their status as we work on this together.
I would like to be able to use google sheets as my data persistence layer.  This is because I'll be getting various CSVs and spreadsheets from other sources that I can easily upload to Google Drive, and I'd like this "Madison Ultimate App" to provide nice rendering and editing on top of this data.  Google sheets are also nice because it is easy for me and other coaches to see data across the whole team, easily sort/filter, make bulk edits, etc. without needing to write code or SQL.

### Stage 1: Signup Steps Reporting
For any player that wants to join the ultimate frisbee team, there are multiple steps they need to take:
1. Complete SPS Final Forms (has 3 stages)
1.1 Parents Signed
1.2 Students Signed
1.3 Physical Clearance
2. Complete "Additional Questionaire For Coaches"
3. At least one caretaker needs to signup for the "team mailing list

I want a nicely formatted table that uses the data sources below that has these columns:

Player First Name
Player Last Name
PLayer Grade
Player Gender
Has Caretaker Signed Final Forms
Has Player Signed Final Forms
Does Player Have a Cleared Physical
Has a Caretaker filled out the "Additional Questionaire for Coaches"
Has Caretaker 1 joined the "Team Mailing List"
Has Caretaker 2 joined the "Team Mailing List"

You are going to have join across these data sources.
Please analyze your "join keys", but it will often be player name or email address.
Unforunately though because this is human-entered data, it's possible that there is misspellings between the data sources and so you may need to do fuzzy matching or create a translation layer.

### Stage 2: Roster Synthesis from Data Sources
I need functionality that will ultimate build or update the team roster, which is stored in the "Roster" sheet of https://docs.google.com/spreadsheets/d/1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8/edit?gid=267530468#gid=267530468
This will use similar/same data sources as Stage 1.
The roster sheet uses the first 5 rows to specify the intended data for the column.  This metadata includes:
- Column Name: the name of the column for the roster sheet.
- Type: the type of the data (e.g., string, email address)
- Source: what data source this should be populated from.  It usually specifies the data source name and the data source column.  If no data source colum is provided, it can be assumed to share the same name as the "column name"
- Human editable: whether the underlying data source is the source of truth or just a "seed" for the initial value.  If the data source is the source of truth (i.e., human editable is FALSE) then anytime this syntehsis process is run it will use the values from the data source rather than what is in the sheet.  If human editable is TRUE than the values that already exist in the sheet should be respected.
- Additional note: provides extra notes on how the field should be set.

There should be one row per player in the sheet, and the list of players is derived from Final Forms.
Don't delete players from the roster if they're not on Final Forms.

This doesn't need to be mobile friendly.  This is an admin function that I will run from a desktop browser.

The same guidance from Stage 1 applies about joining.  Be lenient on misspelling and do fuzzy matching if it helps.  

In summary, if I load `/build-roster` I expect:
- the roster sheet gets filled in or updated based on the underlying data sources.
- output includes:
   - number of new rows inserted
   - number of rows updated
   - list of player names that exist on the roster but don't exist in the Final Forms sheet
   - name/link of the SPS Final Forms file that was used
   - name/link of the Team Mailing List file that was used

### Stage 3: Player Portal for seeing player info and marking availability
I ended up not really using the work for Stage 1 and Stage 2.  I ended up using a separate process to build my player roster.  

I now want to build a player portal that presents a web interface for each player.  Each player and their family should be able to see their player's portal.

Here are the requirements for the portal:
1. If a player comes to /player-portal, they should be presented the option to "login" for their player.  I want login to be very simple though.  Login involves typing in the player later name (text box), player birth month (2 digits), and player birth year (2 digits).  When the backend receives <lastName,birthMonth,birthYear>, it should try and lookup the player in the roster using the "Player Portal Lookup Key" column.  If it doesn't find one, report an error to the user and they can try again.  If it does find one, it should redirect the user to `/player-port/$playerPortalId` where `$playerPortalId` is defined by the "Player Portal ID" column.
2. `/player-port/$playerPortalId` is a pseudo secret URL.  It should be fine for a family to bookmark.  The `$playerPortalId` should be used to lookup the the player in the roster.
3. For now the player roster will be basic with 3 screens: 
  - Season Info and News
  - Player Info
  - Practice Availability
  - Game Availability

I'll give further instructions later about what each of these screens should look like.  Just make sure there is easy mobile friendly navigation between them and that it also works well on desktop.  So maybe on mobile we follow the pattern of a bottom bar navigation?

I actually expect to use this Stage of the project.  It is fine to discard code or notes regarding stage 1 or 2 since those were experiments.  I want to make sure that stage 3 ("the player portal") is kept clean and maintainable.  Documentation should be tailored towards the this stage.  I do expect though to deploy using the existing mechanism with vercel and the existing conventions are true, like using conventional commits.

## Data Sources
### SPS Final Forms
Exports of this data is https://drive.google.com/drive/folders/1SnWCxDIn3FxJCvd1JcWyoeoOMscEsQcW?usp=drive_link
Use the most recent export.
The export time is in the filename as a ISO8601 datetime (e.g., 2025-09-05T05:15:38Z).
There is one row per player that signed up.  
There is contact info for at least one caretaker, but likely two.

### Additional Questionaire for Coaches
Responses are in this sheet: https://docs.google.com/spreadsheets/d/1f_PPULjdg-5q2Gi0cXvWvGz1RbwYmUtADChLqwsHuNs/edit?usp=sharing .  
This updates as new entries come in.
There should be one entry per player.

### Team Mailing List
The team mailing list is madisonultimatefall25@googlegroups.com.
You can see exports of who is on the mailing list in https://drive.google.com/drive/folders/1pAeQMEqiA9QdK9G5yRXsqgbNVzEU7R1E?usp=drive_link
Use the most recent export.
The export time is in the filename as a ISO8601 datetime (e.g., 2025-09-05T05:15:38Z).
There is one row per player caretaker that signed up. 

### Team Roster Spreadsheet
The official roster used by coaches is stored in https://docs.google.com/spreadsheets/d/1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8/edit?gid=267530468#gid=267530468
It wasn't built using this webapp, but it is the source of truth on our players.

# Steve Scratchpad
Note: ignore this section for now.  It is just raw notes and is not ready to handled.  
Have a spreadsheet for roster creation where I see:
- Name
- Grade
- Gender
- Attendance expected
- Attendance notes
- Game attendance expected
- Game note

Ability for families to mark whether their player will be at a game or practice and leave a note

Record who actually was at a game or not

Reliably get messages sent out and not that it's getting seen by at least one adult affiliated with the player.
