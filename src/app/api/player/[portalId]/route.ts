import { NextRequest, NextResponse } from 'next/server';
import { getPlayerDataByPortalId } from '../../../../lib/portal-cache';
import { extractPlayerData } from '../../../../lib/column-validation';

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

    // Step 2: Extract player information using validated column access
    // This eliminates the need for additional API calls and provides fail-fast behavior for missing columns
    const player: PlayerData = extractPlayerData(playerData);

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