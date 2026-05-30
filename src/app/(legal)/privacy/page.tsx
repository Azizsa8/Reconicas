// Privacy policy. Baseline KSA-aware draft — review with a KSA-experienced
// lawyer before public launch (PDPL Art. 12, 15, 18, 22 specifically).

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · ReconCart",
};

const LAST_UPDATED = "2026-05-30";

export default function PrivacyPolicyPage() {
  return (
    <article className="prose-legal">
      <h1>Privacy Policy</h1>
      <p className="text-[var(--fg-muted)] text-[13px]">
        Last updated: {LAST_UPDATED}
      </p>

      <p>
        ReconCart (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;ReconCart&rdquo;) operates a
        competitive-intelligence service for online merchants. This Privacy
        Policy explains what personal data we collect, how we use it, who we
        share it with, and how you can exercise your rights under the Saudi
        Personal Data Protection Law (PDPL) and the EU General Data Protection
        Regulation (GDPR), where applicable.
      </p>

      <h2>1. Data we collect</h2>
      <h3>1.1 Account data</h3>
      <ul>
        <li><strong>Email address</strong> — for sign-in, password reset, and
        operational alerts.</li>
        <li><strong>Password</strong> — stored as a salted bcrypt hash by our
        authentication provider, Supabase. We never see your plaintext
        password.</li>
        <li><strong>Display name</strong> — optional, shown only inside your
        own workspace.</li>
        <li><strong>Workspace name</strong> — the label you chose for your
        ReconCart workspace.</li>
      </ul>

      <h3>1.2 Service data</h3>
      <ul>
        <li><strong>Tracked URLs</strong> — the competitor product pages you
        paste into ReconCart.</li>
        <li><strong>Scrape results</strong> — product name, price, stock,
        rating, and metadata extracted from those public pages.</li>
        <li><strong>Alert conditions and history</strong> — the rules you set
        and the alerts they fire.</li>
        <li><strong>Delivery channels</strong> — the destinations (webhook
        URLs, email addresses) where we send your alerts.</li>
      </ul>

      <h3>1.3 Technical data</h3>
      <ul>
        <li><strong>IP address and User-Agent</strong> — recorded in server
        access logs by our hosting provider for security and abuse
        prevention. Retained for 30 days.</li>
        <li><strong>Session cookies</strong> — see our{" "}
        <a href="/cookies">Cookies Policy</a> for the full list.</li>
        <li><strong>Audit log</strong> — every consequential action you take
        (creating tracks, deleting channels, etc.) is recorded with your user
        id, timestamp, and action metadata for security forensics.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <p>We process your data on the following lawful bases:</p>
      <ul>
        <li><strong>Contract</strong> (PDPL Art. 6(1)(b), GDPR Art. 6(1)(b))
        — to provide and operate the ReconCart service you signed up for:
        running scrapes, evaluating your conditions, dispatching alerts.</li>
        <li><strong>Legitimate interest</strong> (GDPR Art. 6(1)(f)) — to
        secure our infrastructure, prevent abuse, and improve the service.
        Audit logs, rate limiting, and bot detection fall here.</li>
        <li><strong>Consent</strong> (PDPL Art. 6(1)(a), GDPR Art. 6(1)(a))
        — where required for non-essential cookies or marketing
        communications.</li>
        <li><strong>Legal obligation</strong> — to respond to lawful requests
        from KSA, EU, or other authorities with jurisdiction.</li>
      </ul>

      <h2>3. Who we share it with</h2>
      <p>
        We use the following sub-processors. Each is a contractually-bound
        data processor; none of them sell your data.
      </p>
      <ul>
        <li><strong>Supabase Inc.</strong> (USA) — authentication and
        Postgres database hosting. Region: us-east-1.</li>
        <li><strong>Vercel Inc.</strong> (USA / global) — application and
        function hosting, CDN, access logs.</li>
        <li><strong>Resend Inc.</strong> (USA) — transactional email delivery
        (signup confirmations, password resets, alert emails).</li>
        <li><strong>Moyasar Financial Company</strong> (KSA) — payment
        processing once paid plans are enabled. Card data is tokenized; we
        never store full PANs.</li>
      </ul>
      <p>
        When you configure outbound delivery channels (webhooks, Slack, custom
        endpoints), we transmit your alert payloads to those destinations on
        your instruction. Those destinations are not our sub-processors;
        you are responsible for their handling of the data you send them.
      </p>

      <h2>4. Cross-border transfers</h2>
      <p>
        Our primary infrastructure providers are based in the United States.
        Personal data may therefore be transferred outside the Kingdom of
        Saudi Arabia and the European Economic Area. We rely on the standard
        contractual clauses approved under GDPR Art. 46 and the equivalent
        PDPL transfer mechanisms (Art. 29) for such transfers.
      </p>

      <h2>5. Retention</h2>
      <ul>
        <li>Account data: while your account is active, deleted within 30
        days after you delete your account.</li>
        <li>Scrape results and alert history: 24 months by default. You can
        delete individual tracks at any time, which cascades through their
        scrapes, conditions, alerts, and deliveries.</li>
        <li>Server access logs: 30 days.</li>
        <li>Audit log: 36 months, then pruned.</li>
        <li>Backups: encrypted snapshots retained for 7 days by our
        database provider.</li>
      </ul>

      <h2>6. Your rights</h2>
      <p>
        Under PDPL (Art. 4-12) and GDPR (Art. 13-22) you have the right to:
      </p>
      <ul>
        <li><strong>Access</strong> — download a JSON export of all your
        ReconCart data from Settings &rarr; Data &rarr; Export.</li>
        <li><strong>Rectification</strong> — update your profile and
        workspace name directly in Settings.</li>
        <li><strong>Erasure</strong> — delete your account permanently from
        Settings &rarr; Data &rarr; Delete. This is irreversible.</li>
        <li><strong>Restriction and objection</strong> — contact us at the
        address below.</li>
        <li><strong>Portability</strong> — the JSON export is a
        machine-readable format.</li>
        <li><strong>Withdraw consent</strong> — for cookie categories or
        marketing emails, at any time.</li>
        <li><strong>Lodge a complaint</strong> with the Saudi Data &amp; AI
        Authority (SDAIA) or your local supervisory authority.</li>
      </ul>

      <h2>7. Security</h2>
      <p>
        We use industry-standard measures: TLS 1.2+ in transit, AES-256 at
        rest in our database provider, row-level security policies that scope
        every query to the requesting user&apos;s workspace, signed webhook
        bodies (HMAC-SHA256) so receivers can verify authenticity, salted
        bcrypt password hashing, and rate limiting on authentication
        endpoints.
      </p>
      <p>
        No system is perfectly secure. If you become aware of a vulnerability,
        please report it to <a href="mailto:security@reconcart.com">security@reconcart.com</a>.
        We respond to legitimate reports within 72 hours.
      </p>

      <h2>8. Children</h2>
      <p>
        ReconCart is a business-to-business product. We do not knowingly
        collect data from anyone under 18. If you believe we have collected
        data from a minor, contact us and we will delete it.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        announced via the email address on file at least 30 days before
        taking effect. The current version is always available at this URL.
      </p>

      <h2>10. Contact</h2>
      <p>
        Data protection inquiries:{" "}
        <a href="mailto:privacy@reconcart.com">privacy@reconcart.com</a>
        <br />
        General contact: <a href="mailto:hello@reconcart.com">hello@reconcart.com</a>
      </p>
    </article>
  );
}
