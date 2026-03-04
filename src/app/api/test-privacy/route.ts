import { NextResponse } from 'next/server';
import { obfuscatePlayerName } from '@/lib/privacy';

export async function GET() {
  // Test the obfuscation function with generic examples (no real names)
  const testCases = [
    { firstName: 'TestFirst', lastName: 'TestLast' },
    { firstName: 'A', lastName: 'B' },
    { firstName: 'First', lastName: 'Last' },
    { firstName: 'Sample', lastName: 'User' },
    { firstName: 'X', lastName: 'Y-Z' }
  ];

  const results = testCases.map(test => ({
    original: `${test.firstName} ${test.lastName}`,
    obfuscated: obfuscatePlayerName(test.firstName, test.lastName)
  }));

  return NextResponse.json({
    message: 'Privacy obfuscation test results',
    examples: results
  });
}