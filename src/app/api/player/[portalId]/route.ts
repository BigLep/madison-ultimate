import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/google-api';

const ROSTER_SHEET_ID = process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8';

interface PlayerData {
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: number;
  gender: string;
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

    // Step 1: Get metadata to understand column structure
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

    // Find Portal ID column
    const portalIdIndex = Object.keys(columnMap).find(key =>
      key.toLowerCase().includes('portal') &&
      key.toLowerCase().includes('id') &&
      !key.toLowerCase().includes('lookup')
    );

    if (!portalIdIndex) {
      return NextResponse.json({
        success: false,
        error: 'Portal ID column not found'
      }, { status: 500 });
    }

    // Step 2: Get roster data and find player by Portal ID
    const rosterData = await getSheetData(ROSTER_SHEET_ID, 'A5:AZ1000'); // Skip metadata rows

    let playerRow: any[] | null = null;
    for (const row of rosterData) {
      const rowPortalId = row[columnMap[portalIdIndex]]?.toString().trim();
      if (rowPortalId === portalId) {
        playerRow = row;
        break;
      }
    }

    if (!playerRow) {
      return NextResponse.json({
        success: false,
        error: 'Player not found with the provided Portal ID'
      }, { status: 404 });
    }

    // Step 3: Map row data to structured player object using dynamic column discovery
    const getValue = (columnName: string): string => {
      const index = columnMap[columnName];
      return index !== undefined ? (playerRow![index]?.toString().trim() || '') : '';
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
        pronouns: getValue('Player Pronouns (select all that apply)'),
        allergies: getValue('Player Allergies'),
        competingSports: getValue('Competing Sports and Activities'),
        jerseySize: getValue('Jersey Size'),
        playingExperience: getValue('Playing Experience'),
        playerHopes: getValue('Player hopes for the season'),
        otherInfo: getValue('Other Player Info'),
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