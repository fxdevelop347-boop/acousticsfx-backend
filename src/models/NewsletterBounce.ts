import type { Collection } from 'mongodb';
import type { NewsletterBounce } from '../types/index.js';
import { getDb } from '../config/db.js';

const COLLECTION = 'newsletter_bounces';

export function getNewsletterBounceCollection(): Collection<NewsletterBounce> {
  return getDb().collection<NewsletterBounce>(COLLECTION);
}
