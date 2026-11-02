import { intlLocale, t } from '../../i18n';
import './LegalContent.css';

export type LegalDoc = 'privacy' | 'terms' | 'refunds' | 'cookies';

/** Change this whenever the wording below changes, and bump the notice version on the server. */
const LAST_UPDATED = new Date(2026, 10, 3);

/**
 * Where people can reach the developer about their data. Left empty on purpose
 * until there is one: the pages then say "Not available yet".
 */
export const PRIVACY_CONTACT = '';

interface Section {
  heading: string;
  items: string[];
}

export function legalTitle(doc: LegalDoc): string {
  const titles: Record<LegalDoc, string> = {
    privacy: t('Privacy Policy'),
    terms: t('Terms of Service'),
    refunds: t('Refund Policy'),
    cookies: t('Cookie Policy'),
  };
  return titles[doc];
}

function sectionsFor(doc: LegalDoc): Section[] {
  if (doc === 'privacy') {
    return [
      {
        heading: t('What we collect'),
        items: [
          t('Your name, email, phone number and password. Your password is stored scrambled, never as plain text.'),
          t('Your business name, type and address.'),
          t('The products, stock, prices, sales, purchases, expenses and spoiled or damaged items you record, and any photos you upload.'),
          t('The names and contact details of the suppliers and staff you add, and optional map locations of your suppliers.'),
        ],
      },
      {
        heading: t('Why we use it'),
        items: [
          t('We use this only to run your inventory, sales and reports, and to give you forecasts and tips.'),
          t('Your data is not sold and is not used for advertising.'),
        ],
      },
      {
        heading: t('Who helps run the system'),
        items: [
          t('Render, in the United States, runs the app server and the website.'),
          t('Aiven, in the United States, stores the database.'),
          t('Brevo sends password reset emails, so it receives your email address when you ask for one.'),
          t('GitHub provides the app downloads and the update check.'),
          t('Address search and maps use OpenStreetMap services, which receive the text you type or the map position you pick.'),
          t('If "Explain with AI" is turned on, only a product name, its category and its weekly unit counts are sent to the AI service. Your name, customers and prices are never sent.'),
          t('This means your information is stored and processed outside the Philippines.'),
        ],
      },
      {
        heading: t('How long we keep it'),
        items: [
          t('We keep your data until you delete it or delete your account.'),
          t('After deletion, copies may remain in the service providers\' backups for a limited time.'),
        ],
      },
      {
        heading: t('Your rights'),
        items: [
          t('Under the Data Privacy Act of 2012, you can ask to see, correct or delete your data, and you can withdraw your consent.'),
          t('You can download or delete your data yourself in Settings → Your data.'),
          t('The owner controls a store\'s records. Deleting a staff account removes the login, but the records it entered stay with the store, without the name.'),
        ],
      },
      {
        heading: t('Age'),
        items: [t('BantayLedger AI is for people aged 18 or older.')],
      },
    ];
  }

  if (doc === 'terms') {
    return [
      {
        heading: t('About this service'),
        items: [
          t('BantayLedger AI is a student project prepared for a project defense. It is provided as it is, and it may change or stop at any time.'),
        ],
      },
      {
        heading: t('Using your account'),
        items: [
          t('You must be 18 or older to create an account.'),
          t('Keep your password private. You are responsible for what is done with your account.'),
          t('Use the system only for lawful business records, and add other people\'s details only when you have the right to.'),
        ],
      },
      {
        heading: t('Your records'),
        items: [
          t('Your records stay yours, and you are responsible for checking that they are correct.'),
          t('Keep your own copy of important records. We cannot promise that the service will always be available or that data will never be lost.'),
        ],
      },
      {
        heading: t('Forecasts and AI'),
        items: [
          t('Forecasts, alerts and AI-written text are estimates and suggestions, not guarantees or professional advice. You make the final decision.'),
        ],
      },
      {
        heading: t('Plans and payments'),
        items: [
          t('The Subscription page is a demonstration. It takes no real payment, and every store keeps every feature.'),
        ],
      },
      {
        heading: t('Limits and ending'),
        items: [
          t('As far as the law allows, the developer is not liable for losses from using the system.'),
          t('You can stop at any time by deleting your account in Settings → Your data.'),
        ],
      },
    ];
  }

  if (doc === 'refunds') {
    return [
      {
        heading: t('No real payments'),
        items: [
          t('This system takes no real payment, so there is nothing to refund.'),
          t('The GCash reference typed on the Subscription page is a demonstration. It is not checked with GCash, and no money moves.'),
        ],
      },
      {
        heading: t('If that changes'),
        items: [
          t('If real payments are added, the refund terms will be published here before anyone is charged.'),
        ],
      },
      {
        heading: t('Your own customers'),
        items: [
          t('Cash and GCash sales you record are between you and your customers. The system only keeps a record of them.'),
        ],
      },
    ];
  }

  return [
    {
      heading: t('Cookies and tracking'),
      items: [
        t('BantayLedger AI does not use cookies, advertising trackers or analytics tools, so there is no cookie banner.'),
      ],
    },
    {
      heading: t('What is saved on your device'),
      items: [
        t('Your sign-in, so you stay signed in until you sign out or it expires after 30 days.'),
        t('Your language, your chosen store and your update reminders.'),
        t('Records made offline until they are sent, and saved copies so pages can open without internet.'),
      ],
    },
    {
      heading: t('Removing it'),
      items: [
        t('Signing out removes your sign-in and saved copies. Clearing your browser\'s site data removes everything, including records that have not been sent yet.'),
      ],
    },
  ];
}

/** The text of one policy, used on its own page and inside pop-ups during sign-up. */
export function LegalContent({ doc }: { doc: LegalDoc }) {
  const updated = LAST_UPDATED.toLocaleDateString(intlLocale(), { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="bl-legal-text">
      <p className="bl-caption">{t('Last updated: {{date}}', { date: updated })}</p>
      <p>{t('BantayLedger AI is made by Kim G. Decierdo. This page is written in plain language so that it is easy to understand.')}</p>
      {sectionsFor(doc).map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <ul>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <section>
        <h2>{t('Contact')}</h2>
        <dl className="bl-legal-text__contact">
          <div>
            <dt>{t('Developer')}</dt>
            <dd>Kim G. Decierdo</dd>
          </div>
          <div>
            <dt>{t('Contact')}</dt>
            <dd>{PRIVACY_CONTACT || t('Not available yet')}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default LegalContent;
