import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly sb: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) {
      throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset');
    }
    this.sb = createClient(url, key, { auth: { persistSession: false } });
  }

  private toObjectPath(
    bucket: string,
    pathOrUrl?: string | null,
  ): string | null {
    if (!pathOrUrl) return null;
    if (!pathOrUrl.startsWith('http')) {
      return pathOrUrl.replace(`${bucket}/`, '');
    }
    try {
      const u = new URL(pathOrUrl);
      const marker = '/storage/v1/object/';
      const i = u.pathname.indexOf(marker);
      if (i === -1) return null;
      const tail = u.pathname.slice(i + marker.length);
      const parts = tail.split('/');
      if (parts.length < 3) return null;
      const bucketInUrl = parts[1];
      if (bucketInUrl !== bucket) return null;
      return parts.slice(2).join('/');
    } catch {
      return null;
    }
  }

  async removeMany(
    bucket: string,
    pathsOrUrls: Array<string | null | undefined>,
  ) {
    const list = (pathsOrUrls || [])
      .map((x) => this.toObjectPath(bucket, x || undefined))
      .filter((p): p is string => !!p);

    if (list.length === 0) return;

    const { error } = await this.sb.storage.from(bucket).remove(list);
    if (error) {
      this.logger.warn(`Supabase remove warning (${bucket}): ${error.message}`);
    }
  }

  async removeSpjFiles(pathsOrUrls: Array<string | null | undefined>) {
    const bucket = process.env.SUPABASE_SPJ_BUCKET || 'spj-docs';
    return this.removeMany(bucket, pathsOrUrls);
  }

  async removeJobLetterFiles(pathsOrUrls: Array<string | null | undefined>) {
    const bucket = process.env.SUPABASE_JL_BUCKET || 'jobletter-docs';
    return this.removeMany(bucket, pathsOrUrls);
  }

  async removeSampleFiles(pathsOrUrls: Array<string | null | undefined>) {
    const bucket = process.env.SUPABASE_SAMPLE_BUCKET || 'sample-photos';
    return this.removeMany(bucket, pathsOrUrls);
  }
}
