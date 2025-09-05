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
Should take advantage of modern web frameworks but not be overly complex.  I assume that means using React or Next.js but I am open to ption.
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
Unforuntatley though because this is human-entered data, it's possible that there is misspellings between the data sources and so you may need to do fuzzy matching or create a translation layer.

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