import { NextResponse } from 'next/server';
import { obfuscatePlayerName } from '@/lib/privacy';

export async function GET() {
  // Test the obfuscation function with some examples
  const testCases = [
    { firstName: 'Donovan', lastName: 'Alleen-Willems' },
    { firstName: 'Bob', lastName: 'Frank' },
    { firstName: 'Jane', lastName: 'Smith' },
    { firstName: 'Alex', lastName: 'Johnson' },
    { firstName: 'Maria', lastName: 'Garcia-Lopez' }
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