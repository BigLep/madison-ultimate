import { NextResponse } from 'next/server';
import { getCachedSheetData } from '../../../../lib/sheet-cache';
import { validateColumns, createValidationErrorMessage, REQUIRED_COLUMNS } from '../../../../lib/column-validation';

export async function GET() {
  try {
    console.log('Performing system column health check...');

    // Get the roster data to validate columns
    const rosterData = await getCachedSheetData('ROSTER');

    if (rosterData.length < 1) {
      return NextResponse.json({
        success: false,
        error: 'No roster data available for validation'
      }, { status: 500 });
    }

    // Extract available columns
    const columnNameRow = rosterData[0];
    const availableColumns: string[] = [];

    for (let i = 0; i < columnNameRow.length; i++) {
      const columnName = columnNameRow[i]?.toString().trim();
      if (columnName) {
        availableColumns.push(columnName);
      }
    }

    // Validate columns
    const validationResult = validateColumns(availableColumns);
    const errorMessage = validationResult.isValid ? null : createValidationErrorMessage(validationResult);

    return NextResponse.json({
      success: true,
      columnHealth: {
        isValid: validationResult.isValid,
        errorMessage,
        summary: {
          totalColumns: availableColumns.length,
          requiredColumns: REQUIRED_COLUMNS.filter(col => col.required).length,
          optionalColumns: REQUIRED_COLUMNS.filter(col => !col.required).length,
          missingRequired: validationResult.missingRequired.length,
          missingOptional: validationResult.missingOptional.length,
          extraColumns: validationResult.extraColumns.length,
        },
        details: {
          missingRequired: validationResult.missingRequired,
          missingOptional: validationResult.missingOptional,
          extraColumns: validationResult.extraColumns.slice(0, 20), // Limit for response size
          portalColumns: validationResult.portalColumns,
        },
        availableColumns: availableColumns.slice(0, 50), // Limit for response size
      }
    });

  } catch (error) {
    console.error('Column health check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during column validation'
    }, { status: 500 });
  }
}