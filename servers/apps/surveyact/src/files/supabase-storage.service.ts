// server/src/files/supabase-storage.service.ts
import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role di BE
  );
  private bucket = process.env.STORAGE_BUCKET || 'spj-docs';

  async uploadBuffer(file: Buffer, filename: string, folder: string) {
    const path = `${folder}/${Date.now()}-${filename}`;
    const { error } = await this.supabase
      .storage.from(this.bucket)
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return { path };
  }

  async getSignedUrl(path: string, expiresInSec = 3600) {
    const { data, error } = await this.supabase
      .storage.from(this.bucket)
      .createSignedUrl(path, expiresInSec);
    if (error) throw error;
    return data.signedUrl;
  }

  async insertDocumentRow(payload: {
    spj_id?: string | null,
    job_letter_id?: string | null,
    file_name: string,
    mime_type?: string | null,
    size_bytes?: number | null,
    storage_path: string,
    created_by?: string | null, // optional: isi dari auth kamu sendiri
  }) {
    const { data, error } = await this.supabase
      .from('documents')
      .insert({
        spj_id: payload.spj_id ?? null,
        job_letter_id: payload.job_letter_id ?? null,
        file_name: payload.file_name,
        mime_type: payload.mime_type ?? null,
        size_bytes: payload.size_bytes ?? null,
        provider: 'supabase',
        storage_path: payload.storage_path,
        created_by: payload.created_by ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data;
  }
}
