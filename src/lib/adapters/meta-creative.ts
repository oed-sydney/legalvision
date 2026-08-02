import { requireEnv } from "./source-adapter";

/**
 * MetaCreativeAdapter — direct Meta Marketing API (`ads_read`) for creative previews.
 * Meta CDN thumbnail URLs EXPIRE, so previews are fetched server-side and cached into
 * Supabase Storage keyed by creative id + source hash; re-fetched on change; a broken
 * or expired preview falls back to a format icon (never hot-linked client-side).
 */
export class MetaCreativeAdapter {
  readonly name = "meta-creative";

  private token() {
    return requireEnv(this.name, "META_SYSTEM_USER_TOKEN");
  }

  /** Returns { thumbnailUrl, imageUrl, hash } for a creative; caller caches to Storage. */
  async fetchCreative(creativeId: string): Promise<{ thumbnailUrl: string; hash: string }> {
    this.token();
    void creativeId;
    // GET /{creative-id}?fields=thumbnail_url,image_url,object_story_spec
    throw new Error("MetaCreativeAdapter.fetchCreative not wired — supply META_SYSTEM_USER_TOKEN.");
  }
}
