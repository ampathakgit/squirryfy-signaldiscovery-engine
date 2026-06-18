export async function extractSocialMediaLink(url: string): Promise<string | null> {
  // If the URL is already a social media link, return it directly
  const urlLower = url.toLowerCase();
  if (
    urlLower.includes('instagram.com/p/') ||
    urlLower.includes('instagram.com/reel/') ||
    urlLower.includes('instagram.com/tv/') ||
    urlLower.includes('tiktok.com/@') ||
    urlLower.includes('tiktok.com/t/') ||
    urlLower.includes('vm.tiktok.com/') ||
    urlLower.includes('youtube.com/watch') ||
    urlLower.includes('youtube.com/shorts') ||
    urlLower.includes('youtu.be/') ||
    urlLower.includes('twitter.com/') ||
    urlLower.includes('x.com/')
  ) {
    return url;
  }

  // Otherwise, fetch the article HTML and extract the embedded social link
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const html = await response.text();

    const patterns = [
      /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_\-]+/i,
      /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_\.]+\/video\/[0-9]+/i,
      /https?:\/\/vm\.tiktok\.com\/[a-zA-Z0-9]+/i,
      /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_\-]+/i,
      /https?:\/\/(?:www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_\-]+/i,
      /https?:\/\/youtu\.be\/[a-zA-Z0-9_\-]+/i,
      // For Twitter/X, we want specific statuses, avoiding general brand handles or intent tweets
      /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+\/status\/[0-9]+/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        // Return the first match we find
        return match[0];
      }
    }
  } catch (err: any) {
    console.warn(`[extractSocialMediaLink] Error fetching/extracting ${url}:`, err.message);
  }
  return null;
}
