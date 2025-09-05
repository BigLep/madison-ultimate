// Player data types for Stage 1

export interface PlayerSignupStatus {
  firstName: string;
  lastName: string;
  grade: string;
  gender: string;
  hasCaretakerSignedFinalForms: boolean;
  hasPlayerSignedFinalForms: boolean;
  hasPlayerClearedPhysical: boolean;
  hasCaretakerFilledQuestionnaire: boolean;
  hasCaretaker1JoinedMailingList: boolean;
  hasCaretaker2JoinedMailingList: boolean;
}

// Raw data structures from each source
export interface SPSFinalFormsRecord {
  playerFirstName: string;
  playerLastName: string;
  playerGrade: string;
  playerGender: string;
  caretaker1Email: string;
  caretaker2Email?: string;
  parentsSignedStatus: boolean;
  studentsSignedStatus: boolean;
  physicalClearanceStatus: boolean;
}

export interface QuestionnaireRecord {
  playerFirstName: string;
  playerLastName: string;
  caretakerEmail: string;
  submissionTimestamp: string;
}

export interface MailingListRecord {
  email: string;
  name?: string;
  joinedDate: string;
}

// Data processing types
export interface FuzzyMatchResult {
  match: boolean;
  confidence: number;
  matchedName?: string;
}