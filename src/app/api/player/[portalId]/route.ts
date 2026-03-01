import { NextRequest, NextResponse } from 'next/server';
import { getPlayerDataByPortalId } from '../../../../lib/portal-cache';
import { extractPlayerData } from '../../../../lib/column-validation';
import { getSubscriberEmails } from '../../../../lib/buttondown-api';

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
    let player: PlayerData = extractPlayerData(playerData);

    // Step 3: If Buttondown API key is set, override mailing list status from Buttondown subscribers (cached 5 min)
    if (process.env.BUTTONDOWN_API_KEY) {
      try {
        const subscribers = await getSubscriberEmails();
        const check = (email: string | undefined) => {
          if (!email?.trim()) return undefined;
          const lower = email.trim().toLowerCase();
          return subscribers.has(lower) ? 'Subscribed' : 'Not subscribed';
        };
        if (player.contacts.parent1?.email) {
          player = {
            ...player,
            contacts: {
              ...player.contacts,
              parent1: {
                ...player.contacts.parent1!,
                mailingListStatus: check(player.contacts.parent1.email) ?? player.contacts.parent1.mailingListStatus,
              },
            },
          };
        }
        if (player.contacts.parent2?.email) {
          player = {
            ...player,
            contacts: {
              ...player.contacts,
              parent2: {
                ...player.contacts.parent2!,
                mailingListStatus: check(player.contacts.parent2.email) ?? player.contacts.parent2.mailingListStatus,
              },
            },
          };
        }
        if (player.contacts.studentEmails?.personalEmail) {
          player = {
            ...player,
            contacts: {
              ...player.contacts,
              studentEmails: {
                ...player.contacts.studentEmails,
                personalEmailMailingStatus:
                  check(player.contacts.studentEmails.personalEmail) ??
                  player.contacts.studentEmails.personalEmailMailingStatus,
              },
            },
          };
        }
      } catch (err) {
        console.warn('Buttondown subscriber check failed, using roster mailing list status:', err);
      }
    }

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