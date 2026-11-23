export type BlogCategory =
  | 'GST'
  | 'Income Tax'
  | 'TDS & TCS'
  | 'Accounting'
  | 'Excel Templates'
  | 'PF & ESI'
  | 'ROC & MCA'
  | 'Business & Career'
  | 'Banking & UPI'
  | 'PDF & Privacy'
  | 'Regional Tech';

export type BlogCoverTheme =
  | 'tax'
  | 'gst'
  | 'banking'
  | 'upi'
  | 'pdf'
  | 'tulu'
  | 'calendar'
  | 'payroll';

export interface BlogAuthorProfile {
  id: 'arjun-bangera' | 'kaushik-bangera' | 'vcpl-editorial';
  name: string;
  role: string;
  experienceLabel?: string;
  initials: string;
  avatarUrl?: string;
  location: string;
  email: string;
  bio: string;
  expertise: string[];
}

export type BlogContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'label'; text: string }
  | { type: 'bullets'; title?: string; items: string[] }
  | { type: 'ordered'; title?: string; items: string[] }
  | { type: 'table'; title?: string; headers: string[]; rows: string[][] }
  | { type: 'callout'; tone?: 'info' | 'warning'; label: string; text: string }
  | { type: 'code'; filename?: string; language: string; code: string };

export interface BlogSubsection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  blocks?: BlogContentBlock[];
}

export interface BlogArticleSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  proTip?: string;
  blocks?: BlogContentBlock[];
  subsections?: BlogSubsection[];
}

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogPostItem {
  slug: string;
  title: string;
  seoTitle: string;
  excerpt: string;
  seoDescription: string;
  category: BlogCategory;
  topicTags?: BlogCategory[];
  articleType?: 'editorial' | 'technical';
  difficulty?: 'Practical Guide' | 'Intermediate' | 'Advanced';
  hasPasswordLab?: boolean;
  coverImage: string;
  coverImageAlt: string;
  coverTheme: BlogCoverTheme;
  coverBadge: string;
  publishedIso: string;
  publishedLabel: string;
  updatedIso: string;
  updatedLabel: string;
  readTime: string;
  authorId: BlogAuthorProfile['id'];
  author: string;
  authorRole: string;
  keywords: string[];
  relatedToolIds: string[];
  relatedSlugs: string[];
  keyTakeaways: string[];
  sections: BlogArticleSection[];
  faqs: BlogFaqItem[];
  conclusion?: string[];
  disclaimer?: string;
}
