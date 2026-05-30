// Terms of Service. Baseline KSA-aware draft — review with a KSA-experienced
// lawyer before public launch.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · ReconCart",
};

const LAST_UPDATED = "2026-05-30";

export default function TermsPage() {
  return (
    <article className="prose-legal">
      <h1>Terms of Service</h1>
      <p className="text-[var(--fg-muted)] text-[13px]">Last updated: {LAST_UPDATED}</p>

      <p>
        These Terms of Service (the &ldquo;Terms&rdquo;) govern your access to
        and use of the ReconCart service, accessible at{" "}
        <a href="https://reconcart.vercel.app">reconcart.vercel.app</a> and any
        related domains (collectively, the &ldquo;Service&rdquo;). By creating
        an account or otherwise using the Service, you agree to be bound by
        these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        ReconCart helps online merchants monitor the prices, stock levels, and
        reviews of products listed on third-party storefronts (the
        &ldquo;Target Sites&rdquo;), and dispatches alerts when conditions you
        define are met. The Service is provided on a software-as-a-service
        basis.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years of age and able to enter into a legally
        binding contract under the laws of the Kingdom of Saudi Arabia or
        your jurisdiction of residence. By creating an account you represent
        that you are.
      </p>

      <h2>3. Account responsibilities</h2>
      <ul>
        <li>You are responsible for all activity on your account and for
        keeping your password secret.</li>
        <li>You must notify us immediately at{" "}
        <a href="mailto:security@reconcart.com">security@reconcart.com</a> of
        any suspected unauthorised access.</li>
        <li>You must not share your account credentials.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Use the Service to violate any applicable law, including the
        Saudi Anti-Cybercrime Law, the EU Computer Misuse equivalents, or
        any Target Site&apos;s terms of service in a way that creates legal
        liability for ReconCart.</li>
        <li>Use the Service to scrape or monitor sites you are contractually
        prohibited from monitoring.</li>
        <li>Submit URLs that point to private, internal, loopback, or
        link-local addresses, or attempt to use the Service as a proxy for
        SSRF or port-scanning. Our infrastructure refuses such requests.</li>
        <li>Submit content that infringes third-party intellectual property,
        privacy, or other rights.</li>
        <li>Exceed the rate limits or quotas of your plan, or attempt to
        circumvent them.</li>
        <li>Reverse engineer, decompile, or attempt to extract source code
        from the Service.</li>
        <li>Use the Service to send unsolicited bulk communications.</li>
      </ul>

      <h2>5. Target Site terms</h2>
      <p>
        ReconCart fetches publicly-accessible HTML from Target Sites and
        extracts structured data using HTML metadata standards (JSON-LD,
        OpenGraph). We do not bypass paywalls, anti-bot measures, or login
        screens. You acknowledge that:
      </p>
      <ul>
        <li>Some Target Sites prohibit automated access in their terms of
        service. You are responsible for verifying whether you are permitted
        to monitor a given Target Site for your commercial purposes.</li>
        <li>Target Site content changes over time and may be inaccurate.
        ReconCart provides the data as-is.</li>
        <li>If a Target Site sends us a cease-and-desist, we may disable
        tracks pointing at that site without prior notice.</li>
      </ul>

      <h2>6. Plans, fees, and billing</h2>
      <ul>
        <li>The free plan permits a limited number of tracks and scrapes per
        day. Paid plans unlock higher limits and additional features.</li>
        <li>Paid plans are billed in advance via Moyasar. By subscribing you
        authorise Moyasar to charge your payment method on a recurring
        basis.</li>
        <li>Fees are exclusive of VAT and any other applicable taxes, which
        will be added at the prevailing rate.</li>
        <li>You may cancel at any time from Settings &rarr; Billing. Your
        plan remains active through the end of the current billing period
        and is not pro-rated.</li>
        <li>We do not offer refunds for partial periods except where required
        by law.</li>
        <li>We may change plan pricing on 30 days&apos; notice via email.
        Continued use after the effective date constitutes acceptance.</li>
      </ul>

      <h2>7. Termination</h2>
      <p>
        You may delete your account at any time from Settings &rarr; Data.
        We may suspend or terminate your account if you breach these Terms,
        with notice where practicable. On termination:
      </p>
      <ul>
        <li>Your right to access the Service ceases immediately.</li>
        <li>Tracks, scrapes, alerts, channels, and deliveries are cascade
        deleted within 30 days, subject to retention requirements in our
        Privacy Policy.</li>
        <li>You may export your data via Settings &rarr; Data before
        deletion.</li>
      </ul>

      <h2>8. Intellectual property</h2>
      <p>
        ReconCart and its trademarks, code, and content are owned by us or
        our licensors. The Terms grant you a limited, non-exclusive,
        non-transferable, revocable licence to use the Service for your
        internal business purposes.
      </p>
      <p>
        Data you submit (URLs, intent descriptions, channel configurations)
        remains yours. You grant us a worldwide, royalty-free licence to use
        that data solely to provide the Service.
      </p>

      <h2>9. Service availability</h2>
      <p>
        We aim for high availability but make no guarantee. The Service is
        provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
        warranties of any kind, except as required by law. Scheduled
        maintenance and unplanned downtime may occur.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, ReconCart will
        not be liable for indirect, incidental, consequential, or
        exemplary damages, lost profits, or lost data arising from your use
        of the Service. Our aggregate liability for direct damages is
        limited to the fees you paid us in the 12 months preceding the
        event giving rise to the claim, or USD 100, whichever is greater.
      </p>
      <p>
        Nothing in these Terms limits liability that cannot be limited by
        applicable law (e.g. for fraud or wilful misconduct).
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold ReconCart harmless from any claim
        arising out of (a) your violation of these Terms, (b) your
        violation of any third-party right (including a Target Site&apos;s
        terms of service), or (c) the data you submit through the Service.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms. Material changes will be announced via
        email at least 30 days before taking effect. Continued use after
        the effective date constitutes acceptance.
      </p>

      <h2>13. Governing law and venue</h2>
      <p>
        These Terms are governed by the laws of the Kingdom of Saudi Arabia,
        without regard to its conflict-of-laws rules. Any dispute will be
        finally resolved by the competent courts of Riyadh, unless mandatory
        local law in your jurisdiction provides otherwise.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:legal@reconcart.com">legal@reconcart.com</a>
      </p>
    </article>
  );
}
