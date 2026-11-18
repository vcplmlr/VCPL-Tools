export type LegalPageSlug =
  | 'about-us'
  | 'contact-us'
  | 'privacy-policy'
  | 'terms-and-conditions'
  | 'disclaimer'
  | 'cookie-policy'
  | 'advertising-policy'
  | 'faq'
  | 'intellectual-property'
  | 'security';

export interface LegalSectionBlock {
  heading: string;
  subheading?: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
}

export interface LegalPageContent {
  slug: LegalPageSlug;
  group: 'information' | 'legal';
  navTitle: string;
  title: string;
  subtitle: string;
  effectiveLabel: string;
  sections: LegalSectionBlock[];
}

export const SITE_CONTACT = {
  brand: 'VCPL Tools',
  tagline: 'Practical Browser Tools for Everyday Work',
  developer: 'Arjun Bangera',
  developerEmail: 'arjun.bangera@yahoo.com',
  ideation: 'Kaushik Bangera',
  ideationEmail: 'kaushik.bangera@myyahoo.com',
  email: 'kaushik.bangera@myyahoo.com',
  whatsappDisplay: '+91 7795836605',
  whatsappUrl: 'https://wa.me/917795836605',
  location: 'Mangalore, Coastal Karnataka, India',
  lastUpdated: '16 November 2026',
};

export const LEGAL_PAGES: Record<LegalPageSlug, LegalPageContent> = {
  'about-us': {
    slug: 'about-us',
    group: 'information',
    navTitle: 'About Us',
    title: 'About VCPL Tools',
    subtitle: 'Practical Browser Tools for Everyday Work',
    effectiveLabel: 'Last Updated: 16 November 2026',
    sections: [
      {
        heading: 'Who We Are',
        paragraphs: [
          'VCPL Tools is an independent collection of practical, browser-based utilities developed to simplify everyday digital tasks. Our goal is to make commonly used banking, accounting, taxation, PDF, Excel, calculation and productivity tools accessible through one convenient workspace.',
          'We understand that individuals, students, accountants, business owners, office employees and professionals regularly perform repetitive tasks such as preparing bank deposit slips, converting tax statements into Excel, reconciling GST data, editing PDF documents and calculating financial figures.',
          'VCPL Tools brings these useful utilities together in one place so users can complete their everyday work more conveniently.',
        ],
      },
      {
        heading: 'What We Offer',
        paragraphs: ['Our platform currently provides tools across six major categories:'],
        bullets: [
          '1. Banking & Deposit Slips — SBI and HDFC bank deposit slip generator, Bulk Excel bank slip generator, and Indian Bank IFSC and MICR directory.',
          '2. Tax & GST Utilities — Form 26AS PDF to Excel converter, GSTR-2B vs Tally ITC reconciler, and Invoice to Excel converter.',
          '3. Calculator Hub — Standard and scientific calculator, Loan and home EMI calculator, SIP and investment calculator, FD and PPF calculations, Income tax calculations, plus exam, marks, CGPA, age and date calculations.',
          '4. PDF & Document Tools — PDF merger, PDF splitter, PDF compressor, Image to PDF converter, PDF to JPG and PNG converter, and other PDF utilities available in the workspace.',
          '5. Typing & Text Utilities — English, Hindi and Kannada typing tests, Word and character counter, and Text case converter.',
          '6. QR & Daily Utilities — QR code and UPI QR generator, Barcode generator, INR number-to-words converter, and Password generator.',
        ],
      },
      {
        heading: 'Our Approach',
        paragraphs: [
          'We aim to build simple, useful and accessible tools that reduce repetitive work and improve everyday productivity.',
          'Where supported by the individual tool, processing takes place directly inside the user\'s browser without uploading documents to our servers.',
          'We continuously work to improve existing utilities and introduce additional tools based on practical requirements and user suggestions.',
        ],
      },
      {
        heading: 'Our Independence',
        paragraphs: [
          'VCPL Tools is an independently developed platform. We are not officially affiliated with, sponsored by or endorsed by any bank, government department, tax authority or financial institution mentioned on this website.',
          'Bank names, government form references and financial terminology are used only to identify supported formats and provide informational utility.',
        ],
      },
      {
        heading: 'Contact Us',
        paragraphs: [
          'For suggestions, feedback, technical issues or general enquiries, reach Arjun Bangera at arjun.bangera@yahoo.com or Kaushik Bangera at kaushik.bangera@myyahoo.com, or WhatsApp +91 7795836605 (Mangalore, Coastal Karnataka, India).',
        ],
      },
    ],
  },

  'contact-us': {
    slug: 'contact-us',
    group: 'information',
    navTitle: 'Contact Us',
    title: 'Contact VCPL Tools',
    subtitle: 'Report an issue, request a format, or share feedback directly with Arjun Bangera & Kaushik Bangera.',
    effectiveLabel: 'Last Updated: 16 November 2026',
    sections: [
      {
        heading: 'Get in Touch',
        paragraphs: [
          'We value user feedback and continuously work to improve our tools and services.',
          'If you experience a technical issue, find an error, want to suggest a new utility or have a general enquiry, please contact us.',
        ],
        bullets: [
          'Arjun Bangera (Design & Development): arjun.bangera@yahoo.com',
          'Kaushik Bangera (Ideas & Support): kaushik.bangera@myyahoo.com',
          'WhatsApp: +91 7795836605',
          'Location: Mangalore, Coastal Karnataka, India',
        ],
      },
      {
        heading: 'What Can You Contact Us About?',
        bullets: [
          'Report an issue with a tool.',
          'Suggest a new banking or deposit slip format.',
          'Request a PDF or Excel utility.',
          'Report an incorrect calculation or conversion.',
          'Share feedback about website functionality.',
          'Report a privacy or security concern.',
          'Enquire about advertising or partnerships.',
        ],
      },
      {
        heading: 'Tool Suggestions',
        paragraphs: [
          'We welcome suggestions for additional tools, including bank deposit slips, accounting utilities, GST tools, PDF converters, calculators and other everyday productivity utilities.',
          'Please include the tool name and a brief explanation of what you need.',
          'We review suggestions based on feasibility and usefulness. Submission does not guarantee that a requested tool will be developed.',
          'We aim to respond to genuine enquiries as soon as reasonably possible.',
        ],
      },
    ],
  },

  'privacy-policy': {
    slug: 'privacy-policy',
    group: 'legal',
    navTitle: 'Privacy Policy',
    title: 'Privacy Policy',
    subtitle: 'How VCPL Tools handles files, browser storage, and voluntary communications.',
    effectiveLabel: 'Effective Date: 16 November 2026',
    sections: [
      {
        heading: 'Overview',
        paragraphs: [
          'VCPL Tools respects your privacy. This Privacy Policy explains what information may be processed when you visit our website and use its tools.',
          'Our platform is designed with a focus on browser-based processing and user privacy.',
        ],
      },
      {
        heading: '1. Information We Process — A. Files and Documents',
        paragraphs: [
          'Our PDF, Excel, banking and tax utilities are designed to process supported files locally inside your browser.',
          'Where a tool operates entirely client-side:',
        ],
        bullets: [
          'Your selected documents are processed in your browser.',
          'Your files are not intentionally uploaded to VCPL Tools servers.',
          'We do not intentionally retain copies of documents processed by those tools.',
          'Your documents remain under your control.',
        ],
      },
      {
        heading: '1. Information We Process — B. Information You Voluntarily Provide',
        paragraphs: [
          'However, client-side processing applies only to tools and features that genuinely operate locally. Features that connect to an external service, if introduced, may have different processing requirements.',
          'If you contact us via Email or WhatsApp, submit a tool suggestion, or subscribe to updates, you may provide information such as:',
        ],
        bullets: [
          'Name, if requested.',
          'Email address.',
          'Message or feedback.',
          'Tool suggestions.',
          'Other information you voluntarily submit.',
        ],
      },
      {
        heading: '1. Information We Process — C. Technical Information',
        paragraphs: [
          'We use voluntary contact information to respond to enquiries, review suggestions and provide requested updates.',
          'Our hosting provider, security services or other website infrastructure may process limited technical information, such as:',
        ],
        bullets: [
          'Browser and device information.',
          'IP address.',
          'Requested page information.',
          'Basic server or security logs.',
        ],
      },
      {
        heading: '2. How We Use Information',
        paragraphs: [
          'The actual technical information collected depends on the services configured for the website. Information may be used to:',
        ],
        bullets: [
          'Operate and maintain the website.',
          'Improve the performance and usability of tools.',
          'Respond to support enquiries.',
          'Review user suggestions.',
          'Send requested updates.',
          'Protect the website against abuse and security threats.',
          'Meet applicable legal obligations.',
        ],
      },
      {
        heading: '3. Cookies and Local Storage',
        paragraphs: [
          'We do not intentionally sell users\' personal information.',
          'VCPL Tools uses essential browser localStorage to remember preferences such as your cookie notice choice, favorite tools, and recent tools.',
          'Our current privacy design aims to avoid unnecessary tracking cookies. However, third-party services such as advertising, analytics, hosting or embedded content may use their own technologies if enabled. Their practices are governed by their respective privacy policies.',
        ],
      },
      {
        heading: '4. Third-Party Services & External Links',
        paragraphs: [
          'Our website may use third-party services for hosting, security, advertising, analytics or communication (including external links to WhatsApp or your email client when you choose to send a message).',
          'These services may process technical or other information according to their own terms and privacy policies. VCPL Tools does not control the independent privacy practices of third-party providers.',
        ],
      },
      {
        heading: '5. Data Security',
        paragraphs: [
          'We take reasonable steps to protect the website and information voluntarily submitted to us. However, no website or internet transmission can be guaranteed to be completely secure.',
          'Users should avoid submitting confidential passwords, banking credentials, authentication codes or unnecessary sensitive information through contact forms or suggestions.',
        ],
      },
      {
        heading: '6. Children\'s Privacy',
        paragraphs: [
          'VCPL Tools is intended for general productivity and utility purposes. We do not knowingly seek to collect personal information from children.',
          'Parents or guardians who believe a child has submitted personal information may contact us.',
        ],
      },
      {
        heading: '7. Your Choices',
        bullets: [
          'Choose not to submit personal information.',
          'Clear browser storage and local preferences anytime using the Clear Data button in the Privacy & Cookie Notice.',
          'Stop using any tool at any time.',
          'Contact us regarding information you have voluntarily submitted.',
          'Use available browser controls to manage cookies and website permissions.',
        ],
      },
      {
        heading: '8. Changes to This Policy & Contact',
        paragraphs: [
          'We may update this Privacy Policy when our tools, services or legal requirements change. The revised version will be published on this page with an updated date.',
          'For privacy-related questions, email kaushik.bangera@myyahoo.com or message on WhatsApp at +91 7795836605.',
        ],
      },
    ],
  },

  'terms-and-conditions': {
    slug: 'terms-and-conditions',
    group: 'legal',
    navTitle: 'Terms & Conditions',
    title: 'Terms and Conditions',
    subtitle: 'Rules and responsibilities for using VCPL Tools utilities.',
    effectiveLabel: 'Effective Date: 16 November 2026',
    sections: [
      {
        heading: '1. About the Platform',
        paragraphs: [
          'Welcome to VCPL Tools. By accessing or using this website, you agree to these Terms and Conditions. If you do not agree with these terms, please discontinue using the website.',
          'VCPL Tools is an independent collection of browser-based utilities designed to assist with everyday banking, accounting, taxation, PDF, Excel, calculation, typing and productivity tasks. The website provides tools for convenience and general informational purposes.',
        ],
      },
      {
        heading: '2. Permitted Use',
        paragraphs: ['You may use the website for lawful personal, educational, professional or business purposes. You agree not to:'],
        bullets: [
          'Use the website for unlawful activities.',
          'Attempt to disrupt or damage website functionality.',
          'Introduce malicious code or harmful files.',
          'Attempt unauthorized access to systems or services.',
          'Misuse the tools to create fraudulent documents.',
          'Violate applicable intellectual property rights.',
          'Interfere with other users\' access to the website.',
        ],
      },
      {
        heading: '3. Accuracy of Results',
        paragraphs: [
          'We aim to provide useful and reliable tools. However, results may contain errors or limitations due to file formats, input quality, calculation assumptions, browser compatibility or other technical factors.',
          'You are responsible for reviewing and verifying results before relying on them. In particular:',
        ],
        bullets: [
          'Verify tax and GST figures against official records.',
          'Verify bank details before submitting a deposit slip.',
          'Check converted Excel data against the original document.',
          'Review PDF outputs before uploading or sharing.',
          'Confirm financial calculations independently before making decisions.',
        ],
      },
      {
        heading: '4. No Professional Advice',
        paragraphs: [
          'The tools are not a substitute for professional legal, accounting, taxation, investment or financial advice.',
          'For important decisions, consult a qualified professional or the relevant official authority.',
        ],
      },
      {
        heading: '5. Browser-Based Processing',
        paragraphs: [
          'Many VCPL Tools utilities are designed to process files directly inside your browser. Where client-side processing is used, documents are not intentionally uploaded to our servers by that feature.',
          'Users remain responsible for maintaining their own copies of important documents and verifying the security of their devices.',
        ],
      },
      {
        heading: '6. Third-Party Services',
        paragraphs: [
          'The website may contain links to external websites or services. VCPL Tools is not responsible for the content, availability, security, terms or privacy practices of third-party websites.',
          'Accessing external services is at your own discretion.',
        ],
      },
      {
        heading: '7. Intellectual Property',
        paragraphs: [
          'Website branding, original designs, text, software and other original materials are protected by applicable intellectual property laws.',
          'You may not reproduce, redistribute or commercially exploit protected website materials without permission, except where permitted by law. Third-party names, logos and trademarks remain the property of their respective owners.',
        ],
      },
      {
        heading: '8. Availability',
        paragraphs: [
          'We may update, modify, suspend or discontinue tools or website features at any time.',
          'We do not guarantee uninterrupted access or compatibility with every browser, device or file format.',
        ],
      },
      {
        heading: '9. Limitation of Liability',
        paragraphs: [
          'To the extent permitted by applicable law, VCPL Tools and its developer shall not be liable for indirect or consequential losses arising from the use of the website, including losses resulting from incorrect conversions, calculation errors, document formatting issues or reliance on unverified results.',
          'Nothing in these terms excludes liability that cannot legally be excluded.',
        ],
      },
      {
        heading: '10. Changes to Terms & 11. Governing Law',
        paragraphs: [
          'We may revise these Terms and Conditions from time to time. Continued use of the website after revised terms are published constitutes acceptance of the updated terms, to the extent permitted by law.',
          'These terms are governed by the applicable laws of India. Any disputes will be subject to the jurisdiction of competent courts in accordance with applicable law.',
        ],
      },
      {
        heading: '12. Contact',
        paragraphs: ['Email: kaushik.bangera@myyahoo.com · WhatsApp: +91 7795836605'],
      },
    ],
  },

  disclaimer: {
    slug: 'disclaimer',
    group: 'legal',
    navTitle: 'Disclaimer',
    title: 'General Disclaimer',
    subtitle: 'Important disclosures on bank slips, tax utilities, financial calculators, and document converters.',
    effectiveLabel: 'Last Updated: 16 November 2026',
    sections: [
      {
        heading: 'General Notice',
        paragraphs: [
          'VCPL Tools is an independent utility platform offering browser-based tools for banking, accounting, taxation, GST, PDF conversion, Excel processing, calculations and everyday productivity.',
          'The information and tools provided on this website are intended for general informational and convenience purposes only.',
        ],
      },
      {
        heading: '1. No Government, Bank, or Messaging Platform Affiliation',
        paragraphs: ['VCPL Tools is not affiliated with, authorized by, sponsored by or officially endorsed by:'],
        bullets: [
          'State Bank of India (SBI).',
          'HDFC Bank.',
          'Other banks or financial institutions.',
          'Income Tax Department of India.',
          'Goods and Services Tax Network (GSTN).',
          'Ministry of Finance.',
          'WhatsApp LLC or Meta Platforms, Inc. (WhatsApp branding is used solely as a nominative support link).',
          'Any other government department or statutory authority.',
        ],
      },
      {
        heading: '2. Banking Tools Disclaimer',
        paragraphs: [
          'References to bank names, government forms, tax documents and financial services are used only to describe supported formats or functionalities.',
          'Bank deposit slips, RTGS/NEFT challans and related templates are provided as convenience tools. Users must independently verify:',
        ],
        bullets: [
          'Bank name and branch.',
          'Account number.',
          'IFSC and MICR details.',
          'Beneficiary information.',
          'Amount and payment details.',
          'Current bank requirements.',
        ],
      },
      {
        heading: '3. Tax and GST Disclaimer',
        paragraphs: [
          'Generating a slip does not mean that a transaction has been initiated, approved or completed.',
          'Tools such as Form 26AS PDF to Excel, GSTR-2B reconciliation and Invoice to Excel are designed to assist with data extraction, conversion and comparison.',
          'They do not replace official tax records, GST portal information, professional accounting review or statutory filing requirements. Always verify extracted figures and reconciliation results against original documents and official records.',
        ],
      },
      {
        heading: '4. Financial Calculator Disclaimer',
        paragraphs: [
          'EMI, SIP, FD, PPF and income tax calculations may use assumptions, estimated rates, simplified formulas or selected financial-year rules.',
          'Actual results may differ based on applicable rates, charges, eligibility, dates, financial products and changes in law. Do not treat calculator results as guaranteed returns, investment recommendations or professional tax advice.',
        ],
      },
      {
        heading: '5. PDF and Excel Conversion Disclaimer',
        paragraphs: [
          'Converted files may contain formatting differences, missing text, OCR errors or other inaccuracies depending on document quality and file structure.',
          'Always compare converted documents with the originals before relying on them.',
        ],
      },
      {
        heading: '6. No Guarantee & 7. External Links and Advertisements',
        paragraphs: [
          'Although we aim to maintain useful and reliable tools, we do not guarantee that every result will be error-free, complete or suitable for every purpose. Users are responsible for verifying outputs before using them for official, financial, legal or business purposes.',
          'The website may display third-party advertisements or links. We do not control the products, claims, privacy practices or services offered by independent advertisers and external websites.',
        ],
      },
      {
        heading: '8. Contact',
        paragraphs: ['For questions or concerns: kaushik.bangera@myyahoo.com'],
      },
    ],
  },

  'cookie-policy': {
    slug: 'cookie-policy',
    group: 'legal',
    navTitle: 'Cookie Policy',
    title: 'Cookie & Local Storage Policy',
    subtitle: 'How essential browser storage and cookies work across VCPL Tools.',
    effectiveLabel: 'Effective Date: 16 November 2026',
    sections: [
      {
        heading: 'Overview',
        paragraphs: [
          'VCPL Tools aims to provide a privacy-conscious browsing experience. This policy explains how cookies and browser storage may be used when you visit our website.',
        ],
      },
      {
        heading: '1. What Are Cookies?',
        paragraphs: [
          'Cookies are small text files that websites may store in your browser to remember preferences, support functionality or collect usage information.',
        ],
      },
      {
        heading: '2. Essential Browser Storage',
        paragraphs: [
          'Some features use local browser storage (localStorage) to remember preferences and settings such as your privacy notice decision, favorite tools, and recent tools.',
          'This information remains on your device unless a feature or browser service transfers it elsewhere. Users can clear browser storage anytime through browser settings or via the Clear Data button in the Cookie & Privacy Notice.',
        ],
      },
      {
        heading: '3. File Processing',
        paragraphs: [
          'Many tools are designed to process files directly inside your browser. For those tools, files are processed locally and are not intentionally uploaded to VCPL Tools servers.',
        ],
      },
      {
        heading: '4. Third-Party Cookies',
        paragraphs: [
          'If third-party advertising, analytics or embedded services are enabled, those providers may use cookies or similar technologies. Their collection and use of information are subject to their own policies.',
        ],
      },
      {
        heading: '5. Managing Cookies & 6. Policy Updates',
        paragraphs: [
          'You can manage or delete cookies through your browser settings. Blocking certain cookies or storage features may affect the operation of some website features.',
          'This policy may be updated when website functionality or third-party integrations change.',
        ],
      },
      {
        heading: '7. Contact',
        paragraphs: ['Email: kaushik.bangera@myyahoo.com'],
      },
    ],
  },

  'advertising-policy': {
    slug: 'advertising-policy',
    group: 'legal',
    navTitle: 'Advertising Policy',
    title: 'Advertising & Sponsorship Policy',
    subtitle: 'Standards and separation between sponsored ad slots and VCPL Tools utilities.',
    effectiveLabel: 'Last Updated: 16 November 2026',
    sections: [
      {
        heading: 'Overview',
        paragraphs: [
          'VCPL Tools may display advertisements or sponsored placements to support the maintenance, development and improvement of the platform. We aim to keep advertising separate from the core functionality of our utilities.',
        ],
      },
      {
        heading: '1. Advertising & 2. Sponsored Placements',
        paragraphs: [
          'Advertisements may appear in designated areas of the website and are excluded from print views (such as A4 bank deposit slips). The advertisements may be supplied by advertising networks or direct advertising partners.',
          'Sponsored placements may be used to promote relevant products, services or business partners. Where applicable, sponsored content is clearly identified as Advertisement or Sponsor Placement.',
        ],
      },
      {
        heading: '3. Advertising Standards',
        paragraphs: [
          'We aim to avoid advertisements that are misleading, harmful, inappropriate or unrelated to the general purpose of the platform.',
          'However, third-party advertising systems may determine which advertisements are displayed. We cannot guarantee that every advertisement will always meet our preferences. Users may report inappropriate advertisements to us.',
        ],
      },
      {
        heading: '4. Independence & 5. Data and Privacy',
        paragraphs: [
          'Advertising does not automatically mean that VCPL Tools recommends or endorses the advertiser, its products or its services. Users should independently evaluate any advertised service before purchasing or sharing information.',
          'Third-party advertising providers may use cookies or similar technologies according to their own privacy policies. Please review our Privacy Policy for more information.',
        ],
      },
      {
        heading: '6. Advertising Enquiries',
        paragraphs: ['For direct advertising and sponsorship enquiries: kaushik.bangera@myyahoo.com'],
      },
    ],
  },

  faq: {
    slug: 'faq',
    group: 'information',
    navTitle: 'FAQ',
    title: 'Frequently Asked Questions (FAQ)',
    subtitle: 'Answers about local browser privacy, bank deposit slips, GST/26AS exports, and PDF/image tools.',
    effectiveLabel: 'Last Updated: 16 November 2026',
    sections: [
      {
        heading: '1. Privacy, Security & Browser Processing',
        paragraphs: [
          'Are my PDF, Excel, tax, and bank files uploaded to any server? No. All file-processing tools run directly inside your browser memory using client-side libraries (PDF.js, pdf-lib, SheetJS/xlsx, and HTML5 Canvas). Documents are never transmitted to or stored on VCPL Tools servers.',
          'Where are favorites, recent tools, and template defaults saved? Only inside your own browser localStorage. You can clear all local data anytime via Cookie Preferences in the footer.',
        ],
      },
      {
        heading: '2. Pricing, Access & Independence',
        paragraphs: [
          'Do I need an account or paid plan? No. Every tool is free to use without registration, usage caps, or watermarks.',
          'Is VCPL Tools affiliated with SBI, HDFC Bank, TRACES, GSTN, or Tally? No. VCPL Tools is an independent utility platform. Always double-check account numbers, IFSC codes, tax totals, and reconciled entries before official filing or banking submission.',
        ],
      },
      {
        heading: '3. Banking Deposit Slips & Reconcilers',
        bullets: [
          'Banking Slips: Dedicated A4 printable cash, cheque, and DD deposit slips plus Bulk Excel batch generation for State Bank of India (SBI) and HDFC Bank.',
          'Tax & GST: Form 26AS PDF to Excel workbook converter, GSTR-2B vs Tally ITC audit matcher, PDF Invoice to Excel register extractor, GST Invoice & Quotation Maker, and DMS vs Tally Reconciliation.',
        ],
      },
      {
        heading: '4. PDF Suite & Image Studio',
        bullets: [
          'PDF Utilities: Convert PDF to Word, Excel, PowerPoint, HTML, CSV, RTF, JPG, PNG, and WEBP; merge, split, compress, rotate, delete, reorder, crop, number pages, fill forms, sign, watermark, unlock with authorized password, or protect with AES-256.',
          'Image Studio: Crop JPG, PNG, and WEBP with alpha transparency preserved, remove backgrounds locally, batch resize/compress to KB targets, convert formats, watermark, and inspect pixel DPI.',
        ],
      },
      {
        heading: '5. Direct Help & Support',
        paragraphs: [
          'Need help with a workflow? Use the floating WhatsApp Support Chat widget (which automatically pre-fills context for the tool you are viewing) or email kaushik.bangera@myyahoo.com.',
        ],
      },
    ],
  },

  'intellectual-property': {
    slug: 'intellectual-property',
    group: 'legal',
    navTitle: 'Intellectual Property',
    title: 'Intellectual Property & Trademark Notice',
    subtitle: 'Ownership of VCPL Tools original materials and third-party brand references.',
    effectiveLabel: 'Last Updated: 16 November 2026',
    sections: [
      {
        heading: 'Original Website Materials',
        paragraphs: [
          'The original website design, branding, written content, software and other original materials of VCPL Tools are protected by applicable intellectual property laws.',
          'Unless otherwise stated, these materials may not be copied, reproduced, redistributed or commercially exploited without appropriate authorization.',
        ],
      },
      {
        heading: 'Third-Party Trademarks',
        paragraphs: [
          'Names such as SBI, HDFC, GST, Tally, TRACES, WhatsApp, and other third-party names are mentioned only for identification, compatibility or informational purposes.',
          'All trademarks, logos, brand names and intellectual property rights belong to their respective owners. Their appearance on this website does not imply any partnership, sponsorship, authorization or endorsement.',
        ],
      },
      {
        heading: 'WhatsApp Icon & Brand Fair-Use Notice',
        paragraphs: [
          'WhatsApp® and the WhatsApp telephone-in-speech-bubble logo are registered trademarks of WhatsApp LLC (a Meta Platforms, Inc. company).',
          'VCPL Tools displays the authentic WhatsApp logo strictly for nominative identification in accordance with fair-use principles to show users where our direct developer support link (wa.me/+917795836605) connects.',
          'The WhatsApp mark is reproduced without alteration to its core proportions, is not used as part of VCPL Tools branding or product names, and does not imply any partnership, sponsorship, certification, or endorsement by WhatsApp LLC or Meta Platforms, Inc.',
        ],
      },
      {
        heading: 'Reporting an Intellectual Property Concern',
        paragraphs: ['If you believe that content on VCPL Tools infringes your intellectual property rights, please contact us with:'],
        bullets: [
          'Your name and contact details.',
          'Identification of the protected material.',
          'The URL or location of the content in question.',
          'An explanation of the concern.',
          'Any supporting information.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Contact: kaushik.bangera@myyahoo.com'],
      },
    ],
  },

  security: {
    slug: 'security',
    group: 'information',
    navTitle: 'Security & File Processing',
    title: 'Security & File Processing Notice',
    subtitle: 'How client-side memory processing works and recommended user safety practices.',
    effectiveLabel: 'Last Updated: 16 November 2026',
    sections: [
      {
        heading: 'Browser-Based Processing',
        paragraphs: [
          'VCPL Tools is designed to make everyday document and utility tasks convenient while prioritizing user privacy. Many of our tools are designed to process files locally inside the user\'s browser, including supported operations involving:',
        ],
        bullets: [
          'PDF documents.',
          'Excel spreadsheets.',
          'Bank slip generation.',
          'Tax document conversion.',
          'Invoice extraction.',
          'Image conversion.',
          'Calculations and other utilities.',
        ],
      },
      {
        heading: 'Local Memory Execution',
        paragraphs: [
          'For tools that operate entirely client-side, the selected files are processed in browser memory rather than intentionally uploaded to VCPL Tools servers.',
        ],
      },
      {
        heading: 'User Responsibility',
        paragraphs: ['Users should follow standard digital hygiene:'],
        bullets: [
          'Use trusted and updated browsers.',
          'Verify generated documents before sharing.',
          'Keep backup copies of important files.',
          'Avoid entering passwords or banking credentials into unofficial forms.',
          'Avoid using public or shared devices for confidential documents.',
          'Clear local browser data when appropriate.',
        ],
      },
      {
        heading: 'Important Limitation',
        paragraphs: [
          'Browser-based processing does not automatically guarantee complete security. Device security, browser extensions, malicious files, external services and other factors may affect privacy.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['For security-related concerns: kaushik.bangera@myyahoo.com'],
      },
    ],
  },
};

export const LEGAL_PAGE_LIST: LegalPageContent[] = Object.values(LEGAL_PAGES);
