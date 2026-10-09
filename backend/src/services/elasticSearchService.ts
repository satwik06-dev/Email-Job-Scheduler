import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env.js';
import prisma from '../config/db.js';

export interface EmailDocument {
  id: string;
  userId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
}

export class ElasticSearchService {
  private client: Client | null = null;
  private isConnected = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    try {
      this.client = new Client({
        node: config.elasticsearch.node,
        maxRetries: 2,
        requestTimeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[Elasticsearch] Initialization warning: ${err.message}`);
    }
  }

  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.ensureIndex();
    return this.initPromise;
  }

  private async ensureIndex(): Promise<void> {
    if (!this.client) return;
    try {
      const ping = await this.client.ping();
      if (!ping) {
        console.warn(`[Elasticsearch] Node at ${config.elasticsearch.node} not reachable. Will fall back to database search.`);
        this.isConnected = false;
        return;
      }
      this.isConnected = true;
      const indexExists = await this.client.indices.exists({ index: config.elasticsearch.index });
      if (!indexExists) {
        await this.client.indices.create({
          index: config.elasticsearch.index,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                userId: { type: 'keyword' },
                senderEmail: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                },
                recipientEmail: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                },
                subject: {
                  type: 'text',
                  analyzer: 'standard',
                  fields: { keyword: { type: 'keyword' } },
                },
                body: { type: 'text', analyzer: 'standard' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                etherealPreviewUrl: { type: 'keyword' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        console.log(`[Elasticsearch] Index "${config.elasticsearch.index}" created with schema mapping.`);
      } else {
        console.log(`[Elasticsearch] Connected. Index "${config.elasticsearch.index}" exists.`);
      }
    } catch (error: any) {
      console.warn(`[Elasticsearch] Connection check skipped: ${error.message}. DB search fallback active.`);
      this.isConnected = false;
    }
  }

  /**
   * Index or update an email document in Elasticsearch
   */
  public async indexEmail(email: EmailDocument): Promise<boolean> {
    await this.init();
    if (!this.isConnected || !this.client) {
      return false;
    }
    try {
      await this.client.index({
        index: config.elasticsearch.index,
        id: email.id,
        document: {
          id: email.id,
          userId: email.userId || null,
          senderEmail: email.senderEmail,
          recipientEmail: email.recipientEmail,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledAt: email.scheduledAt,
          sentAt: email.sentAt || null,
          etherealPreviewUrl: email.etherealPreviewUrl || null,
          createdAt: email.createdAt,
        },
        refresh: true,
      });
      return true;
    } catch (error: any) {
      console.warn(`[Elasticsearch] Failed to index document ${email.id}:`, error.message);
      return false;
    }
  }

  /**
   * Search emails using Elasticsearch with fallback to DB
   */
  public async searchEmails(query: string, options?: { status?: string; userId?: string }): Promise<EmailDocument[]> {
    await this.init();
    const cleanQuery = query.trim();

    // If Elasticsearch is connected, execute real Elasticsearch query
    if (this.isConnected && this.client) {
      try {
        const mustClauses: any[] = [];

        if (cleanQuery) {
          mustClauses.push({
            multi_match: {
              query: cleanQuery,
              fields: ['subject^3', 'recipientEmail^2', 'senderEmail^2', 'body'],
              fuzziness: 'AUTO',
            },
          });
        } else {
          mustClauses.push({ match_all: {} });
        }

        const filterClauses: any[] = [];
        if (options?.status) {
          filterClauses.push({ term: { status: options.status } });
        }
        if (options?.userId) {
          filterClauses.push({ term: { userId: options.userId } });
        }

        const response = await this.client.search<EmailDocument>({
          index: config.elasticsearch.index,
          body: {
            query: {
              bool: {
                must: mustClauses,
                filter: filterClauses,
              },
            },
            sort: [{ scheduledAt: { order: 'desc' } }],
            size: 100,
          },
        });

        const hits = response.hits.hits;
        return hits.map((hit) => hit._source as EmailDocument);
      } catch (error: any) {
        console.warn(`[Elasticsearch] Search failed, falling back to database:`, error.message);
      }
    }

    // Fallback: search in relational DB
    const where: any = {};
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.userId) {
      where.userId = options.userId;
    }
    if (cleanQuery) {
      where.OR = [
        { recipientEmail: { contains: cleanQuery } },
        { senderEmail: { contains: cleanQuery } },
        { subject: { contains: cleanQuery } },
        { body: { contains: cleanQuery } },
      ];
    }

    const emails = await prisma.emailJob.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });

    return emails.map((e) => ({
      id: e.id,
      userId: e.userId,
      senderEmail: e.senderEmail,
      recipientEmail: e.recipientEmail,
      subject: e.subject,
      body: e.body,
      status: e.status,
      scheduledAt: e.scheduledAt.toISOString(),
      sentAt: e.sentAt ? e.sentAt.toISOString() : null,
      etherealPreviewUrl: e.etherealPreviewUrl,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      node: config.elasticsearch.node,
      index: config.elasticsearch.index,
    };
  }
}

export const elasticSearchService = new ElasticSearchService();
export default elasticSearchService;
