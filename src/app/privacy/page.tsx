export const metadata = {
  title: 'Privacy Policy | Madison Ultimate',
};

export default function Privacy() {
  return (
    <main className="container mx-auto px-4 py-12 max-w-2xl">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: 'var(--page-title)' }}
      >
        Privacy Policy
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--secondary-text)' }}>
        Madison Ultimate · Last updated August 24, 2026
      </p>
      <div
        className="space-y-6 leading-relaxed"
        style={{ color: 'var(--primary-text)' }}
      >
        <p>
          Madison Ultimate is the ultimate frisbee program at Madison Middle
          School in Seattle, run by volunteer coaches. This site and our related
          tools exist to administer the team: season signup, rosters, schedules,
          practice and game availability, and team communication.
        </p>
        <section>
          <h2 className="text-xl font-semibold mb-2">What we collect</h2>
          <p>
            We collect information that players and their families provide to us
            for team administration: player and parent/guardian names, contact
            information, grade, birthdate, jersey size, allergies, playing
            experience, and availability for practices and games. We also use registration status information
            from Seattle Public Schools&apos; Final Forms system to track
            athletic eligibility.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">How we use it</h2>
          <p>
            This information is used only to run the team: building rosters,
            planning practices and games, verifying eligibility, and
            communicating with families. It is shared only with the team&apos;s
            coaching staff and volunteers who need it, and is never sold or used
            for advertising.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">Where it lives</h2>
          <p>
            Team data is stored in Google Workspace services (Drive, Sheets, and
            Gmail) under the team&apos;s account, and our mailing list is
            managed through Buttondown. Access is limited to team staff.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">Your choices</h2>
          <p>
            You can ask us at any time to see, correct, or delete your
            family&apos;s information, or to opt out of photos and other media.
            Email us at{' '}
            <a
              href="mailto:madisonultimate@gmail.com"
              className="underline"
              style={{ color: 'var(--accent)' }}
            >
              madisonultimate@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
