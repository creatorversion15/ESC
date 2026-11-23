export const POLICY_VERSION = '1.0';
export const POLICY_LAST_UPDATED = 'November 18, 2026';
export const DEFAULT_ESC_CONTACT_EMAIL = 'contact@esc.community';

export interface PolicySection {
  number: number;
  heading: string;
  paragraphs: string[];
}

export interface PolicyDocument {
  id: 'terms' | 'privacy';
  title: string;
  shortTitle: string;
  pdfFilename: string;
  version: string;
  lastUpdated: string;
  subtitle: string;
  sections: PolicySection[];
}

export function buildTermsDocument(contactEmail?: string): PolicyDocument {
  const email = (contactEmail || DEFAULT_ESC_CONTACT_EMAIL).trim() || DEFAULT_ESC_CONTACT_EMAIL;

  return {
    id: 'terms',
    title: 'ENGINEERING STARTUP COMPANY (ESC) — TERMS & CONDITIONS',
    shortTitle: 'Terms & Conditions',
    pdfFilename: 'ESC_Terms_and_Conditions.pdf',
    version: POLICY_VERSION,
    lastUpdated: POLICY_LAST_UPDATED,
    subtitle: 'Official Fellowship, Platform Usage & Community Governance Terms',
    sections: [
      {
        number: 1,
        heading: 'Acceptance',
        paragraphs: [
          'By applying for ESC fellowship or using ESC services, users agree to these terms and applicable community guidelines.',
        ],
      },
      {
        number: 2,
        heading: 'Eligibility',
        paragraphs: [
          'Applicants must provide accurate academic, contact and personal information. Submission does not guarantee selection or membership.',
        ],
      },
      {
        number: 3,
        heading: 'Application Review',
        paragraphs: [
          'All applications are subject to review by the ESC Admin Team. ESC may approve, reject or request additional information.',
        ],
      },
      {
        number: 4,
        heading: 'Startup Ideas and Projects',
        paragraphs: [
          'Submitted ideas and proposals are subject to administrative review. Submission does not mean automatic project approval, funding, mentorship or team formation.',
        ],
      },
      {
        number: 5,
        heading: 'Team Formation',
        paragraphs: [
          'Team creation, invitations and participation are subject to ESC rules, member eligibility and administrative decisions.',
        ],
      },
      {
        number: 6,
        heading: 'Student Responsibilities',
        paragraphs: [
          'Members must behave respectfully, provide accurate information, avoid harassment and respect other members\' work and intellectual property.',
        ],
      },
      {
        number: 7,
        heading: 'Intellectual Property',
        paragraphs: [
          'Students retain ownership of their original work unless they separately agree otherwise in writing. ESC does not claim ownership of a student\'s idea merely because it was submitted to ESC.',
        ],
      },
      {
        number: 8,
        heading: 'Misuse',
        paragraphs: [
          'ESC may restrict or suspend access for fraud, misconduct, misuse of the platform or violations of community rules.',
        ],
      },
      {
        number: 9,
        heading: 'Changes',
        paragraphs: [
          'ESC may update its policies and communicate important changes through the website or official communication channels.',
        ],
      },
      {
        number: 10,
        heading: 'Contact',
        paragraphs: [
          `For questions regarding these Terms & Conditions, contact Engineering Startup Company (ESC) via our official email at ${email} or through the FAQ & Support page on the ESC website (/#/contact).`,
        ],
      },
    ],
  };
}

export function buildPrivacyDocument(contactEmail?: string): PolicyDocument {
  const email = (contactEmail || DEFAULT_ESC_CONTACT_EMAIL).trim() || DEFAULT_ESC_CONTACT_EMAIL;

  return {
    id: 'privacy',
    title: 'ENGINEERING STARTUP COMPANY (ESC) — PRIVACY POLICY',
    shortTitle: 'Privacy Policy',
    pdfFilename: 'ESC_Privacy_Policy.pdf',
    version: POLICY_VERSION,
    lastUpdated: POLICY_LAST_UPDATED,
    subtitle: 'How ESC Collects, Stores, Uses and Protects Member & Applicant Data',
    sections: [
      {
        number: 1,
        heading: 'Information Collected',
        paragraphs: [
          'ESC may collect information provided during registration and fellowship applications, including name, email, college, engineering branch, academic year, location, skills, project details and optional contact information.',
          'When you sign in using Google Authentication (Firebase Authentication), ESC receives your basic Google account identifier, display name, verified email address and profile photo URL. ESC does not collect or store your Google account password.',
        ],
      },
      {
        number: 2,
        heading: 'Purpose',
        paragraphs: [
          'Information is used for application processing, member management, project collaboration, communication, fellowship administration and platform operation.',
          'Application policy acceptance records (acceptance status, timestamp and policy version) are recorded alongside fellowship applications for administrative compliance.',
        ],
      },
      {
        number: 3,
        heading: 'Startup Ideas',
        paragraphs: [
          'Submitted startup and project information may be accessed by authorised ESC administrators for review and programme management. Submitted startup ideas remain private by default until reviewed and approved by the ESC Admin Team.',
        ],
      },
      {
        number: 4,
        heading: 'Information Sharing',
        paragraphs: [
          'Personal information is not publicly displayed or shared with unrelated third parties without a valid purpose or appropriate permission, except where legally required.',
          'ESC does not embed third-party advertising trackers or commercial behavioral analytics networks. Optional external community links (such as an official ESC WhatsApp group link configured by administrators) are only accessed if a member voluntarily clicks them.',
          'Platform data is stored using the infrastructure configured for ESC, specifically Google Firebase Authentication, Cloud Firestore and Google Cloud SQL (PostgreSQL).',
        ],
      },
      {
        number: 5,
        heading: 'Data Security',
        paragraphs: [
          'ESC uses reasonable administrative and technical measures implemented on the platform to protect stored information, including authenticated Google Sign-In sessions, server-side token verification for protected API routes, Firestore Security Rules and role-based access controls restricting administrative views to verified ESC administrators.',
          'No online system can guarantee absolute security, and ESC does not claim external security certifications beyond the technical safeguards actually operating on this platform.',
        ],
      },
      {
        number: 6,
        heading: 'Member Control',
        paragraphs: [
          'Signed-in members can review and update editable profile information (such as academic details, skills, links and bio) directly from their Member Dashboard.',
          `Users may request correction of inaccurate profile or application information and raise requests concerning their personal information through the official ESC contact email (${email}) or the website Contact page (/#/contact).`,
        ],
      },
      {
        number: 7,
        heading: 'Data Retention',
        paragraphs: [
          'Information may be retained as necessary for membership, application records, administration, verification of issued ESC certificates and legal obligations.',
          `Deletion Process: The platform currently allows applicants to manage draft applications and allows verified ESC Super Administrators to remove user accounts or administrative records upon request. To request deletion of your account or personal application records, contact ESC at ${email} from your registered Google account email or via /#/contact. Note that minimal verification records for publicly issued ESC certificates may be retained where required to preserve certificate authenticity.`,
        ],
      },
      {
        number: 8,
        heading: 'Policy Updates',
        paragraphs: [
          'ESC may update this policy and publish the latest version on its website with an updated version number and last-updated date.',
        ],
      },
      {
        number: 9,
        heading: 'Contact',
        paragraphs: [
          `For privacy questions, data correction requests or account deletion inquiries, contact Engineering Startup Company (ESC) via our official email at ${email} or through the FAQ & Support page on the ESC website (/#/contact).`,
        ],
      },
    ],
  };
}
