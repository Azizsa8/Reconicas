// Cookies policy / disclosure. We only set strictly-necessary cookies today;
// no analytics or marketing cookies. This page documents that fact so PDPL
// and ePrivacy obligations are clearly met without a consent banner.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookies Policy · ReconCart",
};

const LAST_UPDATED = "2026-05-30";

export default function CookiesPage() {
  return (
    <article className="prose-legal">
      <h1>Cookies Policy</h1>
      <p className="text-[var(--fg-muted)] text-[13px]">Last updated: {LAST_UPDATED}</p>

      <p>
        ReconCart uses a small number of cookies that are strictly necessary
        to operate the Service. We do not use analytics, advertising, or
        cross-site tracking cookies.
      </p>

      <h2>Cookies we set</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Lifetime</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>sb-&lt;ref&gt;-auth-token</code></td>
            <td>Holds your authenticated session with Supabase. Required to stay signed in.</td>
            <td>Refreshed on each request; expires after 1 week of inactivity.</td>
            <td>Strictly necessary</td>
          </tr>
          <tr>
            <td><code>active_tenant_id</code></td>
            <td>Remembers which workspace you last selected when you are a member of more than one.</td>
            <td>1 year</td>
            <td>Functional</td>
          </tr>
        </tbody>
      </table>

      <h2>Third-party cookies</h2>
      <p>
        We do not embed third-party scripts, social media widgets, or
        advertising trackers on the Service. No cookies are set by any
        party other than ReconCart itself (via the Supabase SDK for the
        authentication cookie).
      </p>

      <h2>Your choices</h2>
      <p>
        Because the only cookies we set are strictly necessary for the
        Service to function, there is nothing to opt out of for our cookies.
        You can clear cookies for the ReconCart domain from your browser
        settings at any time — doing so will sign you out and reset your
        active workspace selection.
      </p>

      <h2>Outbound webhooks and your channels</h2>
      <p>
        When you configure a webhook delivery channel, ReconCart POSTs alert
        payloads to the URL you provide. Those destinations are not under our
        control and may set their own cookies on you when you visit them.
        Review their privacy and cookies policies separately.
      </p>

      <h2>Changes</h2>
      <p>
        If we ever introduce non-essential cookies (e.g. analytics), we will
        update this page and present a consent banner before any such cookie
        is set, in accordance with PDPL Art. 13 and EU ePrivacy
        requirements.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:privacy@reconcart.com">privacy@reconcart.com</a>
      </p>
    </article>
  );
}
