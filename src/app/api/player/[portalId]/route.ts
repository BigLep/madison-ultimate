import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/google-api';
import { findPortalEntryByPortalId } from '../../../../lib/portal-cache';

const ROSTER_SHEET_ID = process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8';

interface PlayerData {
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: number;
  gender: string;
  genderIdentification: string;
  dateOfBirth: string;
  finalFormsStatus: {
    parentSigned: boolean;
    studentSigned: boolean;
    physicalCleared: boolean;
    allCleared: boolean;
  };
  contacts: {
    parent1?: {
      firstName: string;
      lastName: string;
      email: string;
      mailingListStatus: string;
    };
    parent2?: {
      firstName: string;
      lastName: string;
      email: string;
      mailingListStatus: string;
    };
    studentEmails: {
      spsEmail?: string;
      personalEmail?: string;
      personalEmailMailingStatus?: string;
    };
  };
  additionalInfo?: {
    pronouns?: string;
    allergies?: string;
    competingSports?: string;
    jerseySize?: string;
    playingExperience?: string;
    playerHopes?: string;
    otherInfo?: string;
    questionnaireFilledOut?: boolean;
  };
  photos?: {
    download?: string;
    thumbnail?: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ portalId: string }> }
) {
  try {
    const { portalId } = await params;

    if (!portalId) {
      return NextResponse.json({
        success: false,
        error: 'Portal ID is required'
      }, { status: 400 });
    }

    // Step 1: Validate Portal ID exists in cache and get row info
    const portalEntry = await findPortalEntryByPortalId(portalId);

    if (!portalEntry) {
      return NextResponse.json({
        success: false,
        error: 'Player not found with the provided Portal ID'
      }, { status: 404 });
    }

    // Step 2: Get metadata to understand column structure
    const metadataRows = await getSheetData(ROSTER_SHEET_ID, 'A1:AZ4');

    if (metadataRows.length < 4) {
      return NextResponse.json({
        success: false,
        error: 'Invalid roster metadata structure'
      }, { status: 500 });
    }

    const [columnNameRow] = metadataRows;

    // Create column mapping (dynamic discovery)
    const columnMap: Record<string, number> = {};
    for (let i = 0; i < columnNameRow.length; i++) {
      const columnName = columnNameRow[i]?.trim();
      if (columnName) {
        columnMap[columnName] = i;
      }
    }

    // Step 3: Get the specific player's row data
    const playerRow = await getSheetData(ROSTER_SHEET_ID, `A${portalEntry.rowIndex}:AZ${portalEntry.rowIndex}`);

    if (!playerRow || playerRow.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Player data not found'
      }, { status: 404 });
    }

    // Step 4: Map row data to structured player object using dynamic column discovery
    const getValue = (columnName: string): string => {
      const index = columnMap[columnName];
      return index !== undefined ? (playerRow[0][index]?.toString().trim() || '') : '';
    };

    const getBooleanValue = (columnName: string): boolean => {
      const value = getValue(columnName).toLowerCase();
      return value === 'true' || value === 'yes';
    };

    const player: PlayerData = {
      studentId: getValue('StudentID'),
      firstName: getValue('First Name'),
      lastName: getValue('Last Name'),
      fullName: getValue('Full Name'),
      grade: parseInt(getValue('Grade')) || 0,
      gender: getValue('Gender'),
      genderIdentification: getValue('Gender Identification'),
      dateOfBirth: getValue('Date of Birth'),
      finalFormsStatus: {
        parentSigned: getBooleanValue('Are All Forms Parent Signed'),
        studentSigned: getBooleanValue('Are All Forms Student Signed'),
        physicalCleared: getBooleanValue('Physical Cleared'),
        allCleared: getBooleanValue('Final Forms Cleared?'),
      },
      contacts: {
        studentEmails: {
          spsEmail: getValue('Student SPS Email'),
          personalEmail: getValue('Student Personal Email'),
          personalEmailMailingStatus: getValue('Student Personal Email On Mailing List?'),
        },
      },
      additionalInfo: {
        pronouns: getValue('Pronouns'),
        allergies: getValue('Player Allergies'),
        competingSports: getValue('Competing Sports and Activities'),
        jerseySize: getValue('Jersey Size'),
        playingExperience: getValue('Playing Experience'),
        playerHopes: getValue('Player hopes for the season'),
        otherInfo: getValue('Other Player Info'),
        questionnaireFilledOut: getBooleanValue('Additional Info Questionnaire Filled Out?'),
      },
      photos: {
        download: getValue('Photo Download'),
        thumbnail: getValue('Photo Thumbnail'),
      },
    };

    // Add parent contact information if available
    const parent1FirstName = getValue('Parent 1 First Name');
    const parent1LastName = getValue('Parent 1 Last Name');
    const parent1Email = getValue('Parent 1 Email');

    if (parent1FirstName || parent1Email) {
      player.contacts.parent1 = {
        firstName: parent1FirstName,
        lastName: parent1LastName,
        email: parent1Email,
        mailingListStatus: getValue('Parent 1 Email On Mailing List?'),
      };
    }

    const parent2FirstName = getValue('Parent 2 First Name');
    const parent2LastName = getValue('Parent 2 Last Name');
    const parent2Email = getValue('Parent 2 Email');

    if (parent2FirstName || parent2Email) {
      player.contacts.parent2 = {
        firstName: parent2FirstName,
        lastName: parent2LastName,
        email: parent2Email,
        mailingListStatus: getValue('Parent 2 Email On Mailing List?'),
      };
    }

    return NextResponse.json({
      success: true,
      player
    });

  } catch (error) {
    console.error('Error fetching player details:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}