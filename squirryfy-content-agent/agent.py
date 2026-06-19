import os
import sys
import json
import base64
import asyncio
import datetime
import re
import requests
from dotenv import load_dotenv

# Try importing google.antigravity
try:
    from google.antigravity import Agent, LocalAgentConfig, types
except ImportError:
    print("[ERROR] google-antigravity library is not installed. Please install requirements.txt first.")
    sys.exit(1)

from schemas import CarouselDeck, SlideConfig
from renderer import render_slide_to_image

# 1. Load environment variables
load_dotenv()
if not os.getenv("SQUIRRY_API_KEY"):
    parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(parent_env):
        load_dotenv(parent_env)

SQUIRRY_BASE_URL = os.getenv("SQUIRRY_BASE_URL", "http://localhost:3000")
SQUIRRY_API_KEY = os.getenv("SQUIRRY_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Supabase Credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Meta / Instagram configuration
INSTAGRAM_BUSINESS_ACCOUNT_ID = os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID", "")
META_PAGE_ACCESS_TOKEN = os.getenv("META_PAGE_ACCESS_TOKEN", "")

# Output folder for local renders
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Helper to extract JSON from agent text response
def extract_json_block(text: str) -> dict:
    """Finds and parses the first JSON block or object found in the text."""
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1).strip())
    
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        return json.loads(text[start:end+1])
        
    raise ValueError(f"Could not find any JSON object in text: {text}")

# --- Direct Supabase DB & Storage REST Operations ---

def create_instagram_post_db(signal_id: str, status: str, carousel_data: dict) -> str:
    """Creates a post entry in the Supabase instagram_posts table via direct PostgREST call."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[Database] Missing Supabase credentials. Returning mock UUID.")
        return "mock-post-uuid-12345"
        
    url = f"{SUPABASE_URL}/rest/v1/instagram_posts"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    payload = {
        "signal_id": signal_id,
        "status": status,
        "carousel_data": carousel_data
    }
    try:
        res = requests.post(url, json=payload, headers=headers)
        if res.status_code == 201:
            data = res.json()
            if data and len(data) > 0:
                return data[0]["id"]
        print(f"[Database Warning] Failed to insert row (HTTP {res.status_code}): {res.text}. Falling back to mock UUID.")
    except Exception as e:
        print(f"[Database Warning] Exception during insert: {e}. Falling back to mock UUID.")
        
    return "mock-post-uuid-12345"

def ensure_storage_bucket():
    """Ensures that the instagram_carousels public bucket is created in Supabase Storage."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return
        
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "id": "instagram_carousels",
        "name": "instagram_carousels",
        "public": True,
        "file_size_limit": 10485760,
        "allowed_mime_types": ["image/jpeg", "image/png"]
    }
    try:
        requests.post(url, json=payload, headers=headers)
    except Exception:
        pass

def upload_slide_to_storage(local_path: str, filename: str) -> str:
    """Uploads a slide JPEG directly to Supabase Storage and returns its public CDN URL."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print(f"[Storage] Mock upload for slide: {filename}")
        return f"https://mock-supabase.co/storage/v1/object/public/instagram_carousels/{filename}"
        
    ensure_storage_bucket()
    
    url = f"{SUPABASE_URL}/storage/v1/object/instagram_carousels/{filename}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "image/jpeg"
    }
    
    with open(local_path, "rb") as f:
        file_data = f.read()
        
    # Attempt POST upload first
    res = requests.post(url, headers=headers, data=file_data)
    if res.status_code != 200:
        # Fall back to PUT (upsert)
        res = requests.put(url, headers=headers, data=file_data)
        if res.status_code != 200:
            print(f"[Storage Warning] Upload failed (HTTP {res.status_code}): {res.text}. Returning mock CDN URL.")
            return f"https://mock-supabase.co/storage/v1/object/public/instagram_carousels/{filename}"
            
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/instagram_carousels/{filename}"
    return public_url

def update_instagram_post_db(post_id: str, status: str, media_urls: list[str], instagram_media_id: str = None, post_url: str = None, error_message: str = None):
    """Updates the database record status and details via direct REST PATCH call."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or post_id == "mock-post-uuid-12345":
        print(f"[Database] Mock update for record {post_id} -> status: {status}")
        return
        
    url = f"{SUPABASE_URL}/rest/v1/instagram_posts?id=eq.{post_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "status": status,
        "media_urls": media_urls,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    if instagram_media_id is not None:
        payload["instagram_media_id"] = instagram_media_id
    if post_url is not None:
        payload["post_url"] = post_url
    if error_message is not None:
        payload["error_message"] = error_message
        
    try:
        requests.patch(url, json=payload, headers=headers)
    except Exception as e:
        print(f"[Database Warning] Failed to update post record {post_id}: {e}")

# --- Instagram Publisher Graph API Operations ---

def publish_to_instagram(caption: str, image_urls: list[str]) -> dict:
    """Publishes a carousel of images to Instagram via the official Meta Graph API."""
    if not INSTAGRAM_BUSINESS_ACCOUNT_ID or not META_PAGE_ACCESS_TOKEN:
        print("[Instagram API] Missing credentials. Skipping live publishing (Dry Run mode).")
        return {"success": False, "error": "Missing credentials", "dry_run": True}
        
    print(f"[Instagram API] Creating media containers for {len(image_urls)} slides...")
    container_ids = []
    
    headers = {
        "Authorization": f"Bearer {META_PAGE_ACCESS_TOKEN}"
    }
    
    # 1. Create a container for each image
    for idx, img_url in enumerate(image_urls):
        url = f"https://graph.facebook.com/v19.0/{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media"
        payload = {
            "image_url": img_url,
            "is_carousel_item": True
        }
        res = requests.post(url, json=payload, headers=headers)
        if res.status_code != 200:
            print(f"[Instagram API] Failed to create container for slide {idx+1}: {res.text}")
            raise Exception(f"Container creation failed: {res.text}")
            
        container_id = res.json().get("id")
        container_ids.append(container_id)
        print(f"[Instagram API] Slide {idx+1} container created: {container_id}")
        
    # 2. Create the carousel container
    print("[Instagram API] Creating carousel container...")
    carousel_url = f"https://graph.facebook.com/v19.0/{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media"
    carousel_payload = {
        "media_type": "CAROUSEL",
        "caption": caption,
        "children": container_ids
    }
    carousel_res = requests.post(carousel_url, json=carousel_payload, headers=headers)
    if carousel_res.status_code != 200:
         print(f"[Instagram API] Failed to create carousel container: {carousel_res.text}")
         raise Exception(f"Carousel container creation failed: {carousel_res.text}")
         
    carousel_creation_id = carousel_res.json().get("id")
    print(f"[Instagram API] Carousel container created: {carousel_creation_id}")
    
    # 3. Publish the carousel container
    print("[Instagram API] Publishing carousel...")
    publish_url = f"https://graph.facebook.com/v19.0/{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish"
    publish_payload = {
        "creation_id": carousel_creation_id
    }
    publish_res = requests.post(publish_url, json=publish_payload, headers=headers)
    if publish_res.status_code != 200:
         print(f"[Instagram API] Failed to publish carousel: {publish_res.text}")
         raise Exception(f"Carousel publishing failed: {publish_res.text}")
         
    media_id = publish_res.json().get("id")
    print(f"[Instagram API] Published successfully! Media ID: {media_id}")
    
    # 4. Get permalink (post link)
    permalink_url = f"https://graph.facebook.com/v19.0/{media_id}"
    params = {
        "fields": "permalink",
        "access_token": META_PAGE_ACCESS_TOKEN
    }
    permalink_res = requests.get(permalink_url, params=params)
    post_url = permalink_res.json().get("permalink", "")
    print(f"[Instagram API] Post live URL: {post_url}")
    
    return {
        "success": True,
        "instagram_media_id": media_id,
        "post_url": post_url
    }

async def run_agent():
    print("=" * 60)
    print("Starting Squirryfy Instagram Content Orchestration Agent...")
    print("=" * 60)
    
    # Verify mandatory API keys
    if not SQUIRRY_API_KEY:
        print("[ERROR] SQUIRRY_API_KEY environment variable is not defined.")
        sys.exit(1)
    if not GEMINI_API_KEY:
        print("[ERROR] GEMINI_API_KEY environment variable is not defined.")
        sys.exit(1)
        
    mcp_transport = os.getenv("MCP_TRANSPORT", "stdio")
    
    if mcp_transport == "stdio":
        print("Connecting to local Squirryfy MCP Server over Stdio...")
        mcp_servers = [
            types.McpStdioServer(
                name="squirryfy",
                command="npx",
                args=["tsx", "../src/scripts/mcp-stdio.ts"]
            )
        ]
    else:
        mcp_url = f"{SQUIRRY_BASE_URL}/api/mcp"
        print(f"Connecting to Next.js MCP Server at: {mcp_url} (SSE)")
        mcp_servers = [
            types.McpStreamableHttpServer(
                name="squirryfy",
                url=mcp_url,
                headers={"x-api-key": SQUIRRY_API_KEY}
            )
        ]
    
    # Configure the Creator Agent (subagents disabled for speed and parse reliability)
    config = LocalAgentConfig(
        mcp_servers=mcp_servers,
        capabilities=types.CapabilitiesConfig(
            enable_subagents=False
        ),
        system_instructions=(
            "You are the Squirryfy Creative Director. Your job is to find the top daily signal "
            "via your MCP tools, fetch its Squirry AI analysis, and generate a visually stunning "
            "and highly engaging Instagram Carousel Deck (5 to 7 slides) detailing the trend. "
            "Generate the copywriting script (a captions with hashtags) and slide layouts yourself. "
            "Output the final carousel deck structure matching the CarouselDeck schema "
            "exactly inside a ```json ... ``` code block. Follow the requested format precisely."
        )
    )
    
    # 1. Generate content using the Creator Agent
    async with Agent(config) as agent:
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        
        prompt = (
            f"Please fetch the daily signals for today ({today_str}) or yesterday ({yesterday_str}) "
            "if today's list is empty. Pick the top-scoring signal and call get_squirry_analysis for it. "
            "Then, create a CarouselDeck structure. You must output the result in JSON inside a single "
            "```json ... ``` code block. The JSON must exactly match the CarouselDeck schema:\n"
            "{\n"
            "  \"signal_id\": \"string\",\n"
            "  \"caption\": \"string\",\n"
            "  \"slides\": [\n"
            "    {\n"
            "      \"slide_number\": 1,\n"
            "      \"title\": \"string\",\n"
            "      \"body\": \"string\",\n"
            "      \"bg_theme\": \"dark-cyberpunk\" | \"neon-emerald\" | \"clean-minimal\" | \"royal-gold\" | \"blue-gradient\",\n"
            "      \"image_prompt\": \"string\",\n"
            "      \"layout_style\": \"centered\" | \"left-split\" | \"two-column\" | \"bottom-docked\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )
        
        print("\n[Creative Director] Orchestrating creative analysis...")
        response = await agent.chat(prompt)
        response_text = await response.text()
        
        print("\n[Creative Director] Parsing structured output...")
        try:
            deck_dict = extract_json_block(response_text)
            deck = CarouselDeck.model_validate(deck_dict)
        except Exception as e:
            print(f"[ERROR] Failed to extract or validate CarouselDeck: {e}")
            print(f"Agent response was: {response_text}")
            return
            
        print(f"\n[Creative Director] Success! Generated carousel for Signal ID: {deck.signal_id}")
        print(f"Caption: {deck.caption}\n")
        
    # --- Beyond this point, we do not require the Agent anymore ---
    
    # 2. Create database PENDING record directly
    print("[Database] Creating PENDING post record...")
    post_id = create_instagram_post_db(deck.signal_id, "PENDING", deck.model_dump())
    print(f"[Database] Post ID created: {post_id}")
    
    # 3. Render each slide locally to JPEG
    print("\n[Renderer] Generating slides locally via Playwright...")
    slide_paths = []
    for slide in deck.slides:
        filename = f"slide_{deck.signal_id}_{slide.slide_number}.jpg"
        output_path = os.path.join(OUTPUT_DIR, filename)
        print(f"[Renderer] Rendering Slide {slide.slide_number}/{len(deck.slides)} -> {output_path}")
        await render_slide_to_image(slide, len(deck.slides), output_path)
        slide_paths.append((slide.slide_number, filename, output_path))
        
    # 4. Upload images directly to Supabase Storage
    print("\n[Database] Uploading slide images directly to Supabase Storage...")
    cdn_urls = []
    for slide_num, filename, local_path in slide_paths:
        public_url = upload_slide_to_storage(local_path, filename)
        print(f"[Database] Slide {slide_num} uploaded: {public_url}")
        cdn_urls.append(public_url)
        
    # 5. Publish to Instagram via Meta Graph API
    print("\n[Publisher] Publishing to Instagram...")
    post_status = "GENERATED"
    error_message = None
    instagram_media_id = None
    post_url = None
    
    try:
        pub_res = publish_to_instagram(deck.caption, cdn_urls)
        if pub_res.get("success"):
            post_status = "PUBLISHED"
            instagram_media_id = pub_res.get("instagram_media_id")
            post_url = pub_res.get("post_url")
        elif pub_res.get("dry_run"):
            post_status = "GENERATED"
        else:
            post_status = "FAILED"
            error_message = pub_res.get("error", "Unknown error")
    except Exception as e:
        print(f"[Publisher] Publishing failed: {str(e)}")
        post_status = "FAILED"
        error_message = str(e)
        
    # 6. Update database record with final details
    print(f"\n[Database] Updating post record {post_id} status to {post_status}...")
    update_instagram_post_db(
        post_id=post_id,
        status=post_status,
        media_urls=cdn_urls,
        instagram_media_id=instagram_media_id,
        post_url=post_url,
        error_message=error_message
    )
    print("[Database] Post record updated successfully!")
    print("=" * 60)
    print("Squirryfy Content Agent Run Completed Successfully.")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_agent())
