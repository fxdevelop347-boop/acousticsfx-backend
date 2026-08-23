import type { Collection } from 'mongodb';
import type { NewsletterCampaign } from '../types/index.js';
import { getDb } from '../config/db.js';

const COLLECTION = 'newsletter_campaigns';

export function getNewsletterCampaignCollection(): Collection<NewsletterCampaign> {
  return getDb().collection<NewsletterCampaign>(COLLECTION);
}
