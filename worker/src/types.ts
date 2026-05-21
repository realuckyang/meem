export interface Env {
  AVATAR: DurableObjectNamespace;
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS?: Fetcher;
}
