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
  // Player basic info
  playerFirstName: string;
  playerLastName: string;
  playerGrade: string;
  playerGender: string;
  playerEmail: string;
  playerDateOfBirth: string;
  
  // Parent 1 info
  parent1FirstName: string;
  parent1LastName: string;
  parent1Email: string;
  
  // Parent 2 info
  parent2FirstName?: string;
  parent2LastName?: string;
  parent2Email?: string;
  
  // Status fields
  parentsSignedStatus: boolean;
  studentsSignedStatus: boolean;
  physicalClearanceStatus: boolean;
  
  // Legacy fields for backward compatibility
  caretaker1Email: string;
  caretaker2Email?: string;
}

export interface QuestionnaireRecord {
  playerFirstName: string;
  playerLastName: string;
  caretakerEmail: string;
  submissionTimestamp: string;
  pronouns: string;
  genderIdentification: string;
  allergies: string;
  competingSports: string;
  jerseySize: string;
  playingExperience: string;
  hopesForSeason: string;
  otherInfo: string;
  interestedInCoaching: string;
  ultimateExperience: string;
  teamSportsExperience: string;
  interestedInHelping: string;
  anythingElse: string;
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