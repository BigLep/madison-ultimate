import { NextRequest, NextResponse } from 'next/server';
import { getPlayerDataByPortalId, getColumnValue } from '../../../../lib/portal-cache';

interface PlayerData {
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: number;
  gender: string;
  genderIdentification: string;
  dateOfBirth: string;
  team: string;
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

    console.log(`Fetching player details for Portal ID: ${portalId}`);

    // Step 1: Get player data from cache (includes full row data and column mapping)
    const playerData = await getPlayerDataByPortalId(portalId);

    if (!playerData) {
      return NextResponse.json({
        success: false,
        error: 'Player not found with the provided Portal ID'
      }, { status: 404 });
    }

    // Step 2: Extract player information using the cached data
    // This eliminates the need for additional API calls since we have the full row
    const player: PlayerData = {
      studentId: getColumnValue(playerData, 'Student ID') || '',
      firstName: getColumnValue(playerData, 'First Name') || '',
      lastName: getColumnValue(playerData, 'Last Name') || '',
      fullName: getColumnValue(playerData, 'Full Name') || '',
      grade: parseInt(getColumnValue(playerData, 'Grade') || '0'),
      gender: getColumnValue(playerData, 'Gender') || '',
      genderIdentification: getColumnValue(playerData, 'Gender Identification') || '',
      dateOfBirth: getColumnValue(playerData, 'Date of Birth') || '',
      team: getColumnValue(playerData, 'Team') || '',
      finalFormsStatus: {
        parentSigned: getColumnValue(playerData, 'Parent Signed') === 'TRUE',
        studentSigned: getColumnValue(playerData, 'Student Signed') === 'TRUE',
        physicalCleared: getColumnValue(playerData, 'Physical Cleared') === 'TRUE',
        allCleared: getColumnValue(playerData, 'All Cleared') === 'TRUE'
      },
      contacts: {
        parent1: {
          firstName: getColumnValue(playerData, 'Parent 1 First Name') || '',
          lastName: getColumnValue(playerData, 'Parent 1 Last Name') || '',
          email: getColumnValue(playerData, 'Parent 1 Email') || '',
          mailingListStatus: getColumnValue(playerData, 'Parent 1 Mailing List Status') || ''
        },
        parent2: {
          firstName: getColumnValue(playerData, 'Parent 2 First Name') || '',
          lastName: getColumnValue(playerData, 'Parent 2 Last Name') || '',
          email: getColumnValue(playerData, 'Parent 2 Email') || '',
          mailingListStatus: getColumnValue(playerData, 'Parent 2 Mailing List Status') || ''
        },
        studentEmails: {
          spsEmail: getColumnValue(playerData, 'SPS Email') || undefined,
          personalEmail: getColumnValue(playerData, 'Personal Email') || undefined,
          personalEmailMailingStatus: getColumnValue(playerData, 'Personal Email Mailing Status') || undefined
        }
      }
    };

    // Step 3: Get additional questionnaire data from roster columns
    player.additionalInfo = {
      pronouns: getColumnValue(playerData, 'Prounouns') || undefined,
      allergies: getColumnValue(playerData, 'Player Allergies') || undefined,
      competingSports: getColumnValue(playerData, 'Competing Sports and Activities') || undefined,
      jerseySize: getColumnValue(playerData, 'Jersey Size') || undefined,
      playingExperience: getColumnValue(playerData, 'Playing Experience') || undefined,
      playerHopes: getColumnValue(playerData, 'Player hopes for the season') || undefined,
      otherInfo: getColumnValue(playerData, 'Other Player Info') || undefined,
      questionnaireFilledOut: getColumnValue(playerData, 'Additional Info Questionnaire Filled Out?') === 'TRUE'
    };

    console.log(`Successfully fetched player details: ${player.fullName}`);

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