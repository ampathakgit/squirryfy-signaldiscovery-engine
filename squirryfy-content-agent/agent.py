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

from google import genai
from google.genai import types as genai_types
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

# Global variables for tracking logs
LOGS = []
post_id = None

def log_info(msg: str):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    formatted = f"[{timestamp}] [INFO] {msg}"
    print(formatted)
    LOGS.append(formatted)
    update_logs_db()

def log_error(msg: str):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    formatted = f"[{timestamp}] [ERROR] {msg}"
    print(formatted)
    LOGS.append(formatted)
    update_logs_db()

def update_logs_db():
    if not post_id or post_id == "mock-post-uuid-12345":
        return
    url = f"{SUPABASE_URL}/rest/v1/instagram_posts?id=eq.{post_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "logs": LOGS
    }
    try:
        requests.patch(url, json=payload, headers=headers)
    except Exception as e:
        print(f"[Database Warning] Failed to update logs: {e}")

def convert_single_to_double_quotes(json_string: str) -> str:
    single_quote_pattern = r"'((?:\\.|[^\\'\n])*)'"
    
    def replacer(match):
        content = match.group(1)
        escaped_content = []
        backslash_count = 0
        for char in content:
            if char == '\\':
                backslash_count += 1
                escaped_content.append(char)
            elif char == '"':
                if backslash_count % 2 == 0:
                    escaped_content.append('\\"')
                else:
                    escaped_content.append(char)
                backslash_count = 0
            else:
                if char == "'" and backslash_count % 2 == 1:
                    escaped_content.pop()
                    escaped_content.append("'")
                else:
                    escaped_content.append(char)
                backslash_count = 0
        return f'"{ "".join(escaped_content) }"'
        
    return re.sub(single_quote_pattern, replacer, json_string)

def repair_json(json_string: str) -> str:
    patched = json_string
    patched = convert_single_to_double_quotes(patched)
    
    # Fix unquoted keys
    patched = re.sub(r'([a-zA-Z0-9_]+)\s*:', lambda m: m.group(0) if m.group(1) in ('http', 'https') else f'"{m.group(1)}": ', patched)
    
    # Escape unescaped quotes character-by-character with container tracking
    fixed = []
    in_string = False
    last_structural = '{'
    container_stack = []
    
    i = 0
    n = len(patched)
    while i < n:
        char = patched[i]
        if not in_string:
            if char in ('{', '['):
                container_stack.append(char)
                last_structural = char
            elif char in ('}', ']'):
                if container_stack:
                    container_stack.pop()
                last_structural = char
            elif char in (':', ','):
                last_structural = char
                
            if char == '"':
                in_string = True
                fixed.append(char)
            else:
                fixed.append(char)
        else:
            if char == '"':
                is_escaped = False
                if i > 0 and patched[i-1] == '\\':
                    backslash_count = 0
                    j = i - 1
                    while j >= 0 and patched[j] == '\\':
                        backslash_count += 1
                        j -= 1
                    if backslash_count % 2 == 1:
                        is_escaped = True
                
                if is_escaped:
                    fixed.append(char)
                else:
                    is_closing = False
                    j = i + 1
                    while j < n and patched[j].isspace():
                        j += 1
                    
                    current_container = container_stack[-1] if container_stack else '{'
                    
                    if current_container == '[':
                        if j < n and patched[j] in (',', ']'):
                            is_closing = True
                        elif j == n:
                            is_closing = True
                    else:
                        if last_structural in ('{', ','):
                            if j < n and patched[j] == ':':
                                is_closing = True
                        else:
                            if j < n and patched[j] in (',', '}'):
                                is_closing = True
                            elif j == n:
                                is_closing = True
                            
                    if is_closing:
                        in_string = False
                        fixed.append(char)
                    else:
                        fixed.append('\\"')
            else:
                fixed.append(char)
        i += 1
        
    patched = "".join(fixed)
    
    # Insert missing commas
    patched = re.sub(r'([\}\]"\]])\s*([\{\[\"])', r'\1, \2', patched)
    
    # Remove trailing commas
    patched = re.sub(r',\s*}', '}', patched)
    patched = re.sub(r',\s*]', ']', patched)
    
    # Escape newlines inside strings
    fixed = []
    in_string = False
    i = 0
    n = len(patched)
    while i < n:
        char = patched[i]
        if char == '"' and (i == 0 or patched[i-1] != '\\'):
            in_string = not in_string
            
        if in_string:
            if char == '\n':
                fixed.append('\\n')
            elif char == '\r':
                pass
            elif char == '\t':
                fixed.append('\\t')
            else:
                fixed.append(char)
        else:
            fixed.append(char)
        i += 1
        
    return "".join(fixed)

def extract_json_block(text: str) -> dict:
    """Finds and parses the first JSON block or object found in the text."""
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        repaired = repair_json(match.group(1).strip())
        return json.loads(repaired)
    
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        repaired = repair_json(text[start:end+1])
        return json.loads(repaired)
        
    raise ValueError(f"Could not find any JSON object in text: {text}")

def get_model_sort_key(name: str):
    match = re.search(r"gemini-(\d+(?:\.\d+)*)-flash", name)
    if not match:
        return (0,)
    return tuple(int(x) for x in match.group(1).split("."))

def get_latest_flash_model(api_key: str) -> str | None:
    if not api_key:
        return None
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            return None
        data = response.json()
        models = data.get("models", [])
        if not isinstance(models, list):
            return None
        
        flash_models = []
        for m in models:
            name = m.get("name", "").replace("models/", "")
            if (name.startswith("gemini-") and 
                name.endswith("-flash") and 
                "experimental" not in name and 
                "tuning" not in name):
                flash_models.append(name)
                
        if not flash_models:
            return None
            
        flash_models.sort(key=get_model_sort_key, reverse=True)
        return flash_models[0]
    except Exception as e:
        print(f"[Model Discovery Warning] Failed to fetch latest Gemini models list: {e}")
        return None

def generate_background_image(prompt: str, output_path: str) -> bool:
    """Generates a slide background using gemini-3.1-flash-image."""
    if not GEMINI_API_KEY:
        log_error("GEMINI_API_KEY is not defined. Skipping background image generation.")
        return False
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        log_info(f"Generating background image using gemini-3.1-flash-image for prompt: {prompt[:60]}...")
        full_prompt = (
            f"{prompt}. Premium luxury editorial magazine background, clean design, cinematic lighting, "
            "minimalist style, dark navy and gold primary tones, high-end commercial aesthetic, no text or overlays."
        )
        response = client.models.generate_content(
            model="gemini-3.1-flash-image",
            contents=full_prompt,
            config=genai_types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=genai_types.ImageConfig(
                    aspect_ratio="3:4"
                )
            )
        )
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                with open(output_path, "wb") as f:
                    f.write(part.inline_data.data)
                log_info(f"Successfully generated background image and saved to {output_path}")
                return True
    except Exception as e:
        log_error(f"Failed to generate background image with gemini-3.1-flash-image: {e}. Trying fallback model gemini-2.5-flash-image...")
        try:
            client = genai.Client(api_key=GEMINI_API_KEY)
            full_prompt = (
                f"{prompt}. Premium luxury editorial magazine background, clean design, cinematic lighting, "
                "minimalist style, dark navy and gold primary tones, high-end commercial aesthetic, no text or overlays."
            )
            response = client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=full_prompt,
                config=genai_types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=genai_types.ImageConfig(
                        aspect_ratio="3:4"
                    )
                )
            )
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    with open(output_path, "wb") as f:
                        f.write(part.inline_data.data)
                    log_info(f"Successfully generated background image using fallback gemini-2.5-flash-image: {output_path}")
                    return True
        except Exception as fallback_err:
            log_error(f"Fallback model also failed: {fallback_err}")
    return False

# --- Direct Supabase DB & Storage REST Operations ---

def get_latest_completed_run_id() -> str | None:
    """Queries the database to find the latest completed discovery run ID."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    url = f"{SUPABASE_URL}/rest/v1/discovery_runs"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    params = {
        "status": "eq.COMPLETED",
        "order": "completed_at.desc",
        "limit": "1"
    }
    try:
        res = requests.get(url, headers=headers, params=params)
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                return data[0]["id"]
    except Exception as e:
        print(f"[Database Warning] Exception while querying latest completed run: {e}")
    return None

def get_top_daily_signal(run_id: str = None) -> str:
    """Finds the top-scoring ready signal from the database directly, filtered by run_id if provided."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[Database] Missing Supabase credentials. Returning mock signal.")
        return "mock-signal-12345"
        
    resolved_run_id = run_id
    if not resolved_run_id:
        resolved_run_id = get_latest_completed_run_id()
        if resolved_run_id:
            print(f"[Database] Resolved latest completed run ID: {resolved_run_id}")
        else:
            print("[Database] No completed run found. Searching latest signals globally.")
        
    url = f"{SUPABASE_URL}/rest/v1/discovery_final_signals"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    
    # We query signals ready for analysis, sorted by score desc, in the target run or last 2 days
    params = {
        "ready_for_squirry_analysis": "eq.true",
        "order": "score.desc",
        "limit": "1"
    }
    
    if resolved_run_id:
        params["run_id"] = f"eq.{resolved_run_id}"
    else:
        two_days_ago = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()
        params["created_at"] = f"gte.{two_days_ago}"
    
    try:
        res = requests.get(url, headers=headers, params=params)
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                return data[0]["signal_id"]
        
        # If run_id was provided but had no ready signals, try fallback globally
        if resolved_run_id:
            print(f"[Database] No ready signals found for run ID: {resolved_run_id}. Falling back to global latest signal.")
            fallback_params = {
                "ready_for_squirry_analysis": "eq.true",
                "order": "score.desc",
                "limit": "1"
            }
            res = requests.get(url, headers=headers, params=fallback_params)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    return data[0]["signal_id"]
        else:
            # Fallback to absolute latest ready signal if none found in last 2 days
            params_fallback = {
                "ready_for_squirry_analysis": "eq.true",
                "order": "created_at.desc",
                "limit": "1"
            }
            res = requests.get(url, headers=headers, params=params_fallback)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    return data[0]["signal_id"]
    except Exception as e:
        print(f"[Database Warning] Exception while querying top signal: {e}")
        
    return "mock-signal-12345"

def get_all_daily_signals(run_id: str = None) -> list[str]:
    """Finds all ready signals from the database directly, filtered by run_id if provided."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[Database] Missing Supabase credentials.")
        return []
        
    resolved_run_id = run_id
    if not resolved_run_id:
        resolved_run_id = get_latest_completed_run_id()
        if resolved_run_id:
            print(f"[Database] Resolved latest completed run ID: {resolved_run_id}")
        else:
            print("[Database] No completed run found. Searching latest signals globally.")
        
    url = f"{SUPABASE_URL}/rest/v1/discovery_final_signals"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    
    # We query signals ready for analysis, sorted by score desc, in the target run or last 2 days
    params = {
        "ready_for_squirry_analysis": "eq.true",
        "order": "score.desc"
    }
    
    if resolved_run_id:
        params["run_id"] = f"eq.{resolved_run_id}"
    else:
        two_days_ago = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()
        params["created_at"] = f"gte.{two_days_ago}"
    
    try:
        res = requests.get(url, headers=headers, params=params)
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                signal_ids = [sig["signal_id"] for sig in data]
                print(f"[Database] Found {len(signal_ids)} ready signals for run ID: {resolved_run_id}")
                return signal_ids
        
        # If run_id was provided but had no ready signals, try fallback globally
        if resolved_run_id:
            print(f"[Database] No ready signals found for run ID: {resolved_run_id}. Falling back to global latest signals.")
            fallback_params = {
                "ready_for_squirry_analysis": "eq.true",
                "order": "score.desc"
            }
            res = requests.get(url, headers=headers, params=fallback_params)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    return [sig["signal_id"] for sig in data]
        else:
            # Fallback to absolute latest ready signals if none found in last 2 days
            params_fallback = {
                "ready_for_squirry_analysis": "eq.true",
                "order": "created_at.desc"
            }
            res = requests.get(url, headers=headers, params=params_fallback)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    return [sig["signal_id"] for sig in data]
    except Exception as e:
        print(f"[Database Warning] Exception while querying daily signals: {e}")
        
    return []

def check_squirry_response_exists(signal_id: str) -> bool:
    """Checks the database directly to verify if squirry_response is present and non-null for a signal."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        # Local mock fallback
        return True
    url = f"{SUPABASE_URL}/rest/v1/discovery_final_signals"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    params = {
        "signal_id": f"eq.{signal_id}",
        "select": "squirry_response"
    }
    try:
        res = requests.get(url, headers=headers, params=params)
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                resp = data[0].get("squirry_response")
                return resp is not None
    except Exception as e:
        print(f"[Database Warning] Failed to check squirry_response: {e}")
    return False

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
        "carousel_data": carousel_data,
        "logs": LOGS
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

def update_instagram_post_db(post_id: str, status: str, media_urls: list[str], instagram_media_id: str = None, post_url: str = None, error_message: str = None, carousel_data: dict = None):
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
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "logs": LOGS
    }
    if carousel_data is not None:
        payload["carousel_data"] = carousel_data
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

async def run_agent(run_id: str = None, signal_id: str = None, dry_run: bool = False):
    global post_id
    
    # Verify mandatory API keys
    if not SQUIRRY_API_KEY:
        print("[ERROR] SQUIRRY_API_KEY environment variable is not defined.")
        sys.exit(1)
    if not GEMINI_API_KEY:
        print("[ERROR] GEMINI_API_KEY environment variable is not defined.")
        sys.exit(1)

    # 1. Fetch signal IDs to process
    if signal_id:
        signal_ids = [signal_id]
        print(f"Targeting specific Signal ID: {signal_id}")
    else:
        print("Selecting ready signals from database...")
        signal_ids = get_all_daily_signals(run_id)
        
    if not signal_ids:
        print("No ready signals found to process. Exiting.")
        return

    mcp_transport = os.getenv("MCP_TRANSPORT", "stdio")
    
    if mcp_transport == "stdio":
        mcp_servers = [
            types.McpStdioServer(
                name="squirryfy",
                command="npx",
                args=["tsx", "../src/scripts/mcp-stdio.ts"]
            )
        ]
    else:
        mcp_url = f"{SQUIRRY_BASE_URL}/api/mcp"
        mcp_servers = [
            types.McpStreamableHttpServer(
                name="squirryfy",
                url=mcp_url,
                headers={"x-api-key": SQUIRRY_API_KEY}
            )
        ]
    
    # Resolve the model name
    # 1. First choice: Try dynamic discovery
    model_name = get_latest_flash_model(GEMINI_API_KEY)
    
    if model_name:
        print(f"Dynamically resolved latest Gemini flash model: {model_name}")
    else:
        # 2. Second choice: Fallback to environment variable
        model_name = os.getenv("DEFAULT_GEMINI_MODEL")
        if model_name:
            print(f"Dynamic lookup failed. Using environment variable fallback: {model_name}")
            
    if not model_name:
        # 3. Third choice: Fallback to default
        model_name = "gemini-3.5-flash"
        print(f"Dynamic and env lookups failed. Using default baseline: {model_name}")

    # Configure the Creator Agent (subagents disabled for speed and parse reliability)
    config = LocalAgentConfig(
        model=model_name,
        mcp_servers=mcp_servers,
        capabilities=types.CapabilitiesConfig(
            enable_subagents=False
        ),
        system_instructions=(
            "You are an award-winning Editorial Art Director, Information Designer, Visual Journalist, "
            "Instagram Growth Strategist, and Luxury Magazine Illustrator. Your task is to transform "
            "the supplied content analysis into a premium, magazine-quality Instagram carousel infographic."
        )
    )
    
    # Process each signal sequentially
    for target_signal_id in signal_ids:
        global LOGS
        LOGS = []
        
        # 2. Create the PENDING database record immediately
        print(f"Creating PENDING database record for Signal ID: {target_signal_id}...")
        post_id = create_instagram_post_db(target_signal_id, "PENDING", {})
        
        log_info("=" * 60)
        log_info("Starting Squirryfy Instagram Content Orchestration Agent...")
        log_info(f"Active Post ID: {post_id}")
        log_info(f"Targeting Signal ID: {target_signal_id}")
        log_info("=" * 60)
        
        # Pre-flight Squirry check
        if not check_squirry_response_exists(target_signal_id):
            log_error(f"Squirry response is missing for signal {target_signal_id}. Content generation requires Squirry data.")
            update_instagram_post_db(post_id, "FAILED", [], error_message="Squirry response is missing for this signal. Content generation requires Squirry data.")
            continue
        
        # 3. Generate content using the Creator Agent
        deck = None
        try:
            async with Agent(config) as agent:
                prompt = (
                    f"Please call get_squirry_analysis for the signal with ID '{target_signal_id}' to retrieve the source data.\n\n"
                    "Note: The tool returns a JSON object containing the target signal's 'title', 'canonical_url', and 'squirry_response'. "
                    "You must analyze the returned 'squirry_response' and construct the creative storyboard from it.\n\n"
                    "Transform this specific story data into a premium Instagram carousel. Apply the following design system, storytelling rules, and output structure:\n\n"
                    "────────────────────────────\n"
                    "OBJECTIVE\n"
                    "────────────────────────────\n"
                    "Create a visually stunning Instagram carousel explaining the story. Optimize for shares, saves, and educational/editorial impact.\n"
                    "Style: Luxury Editorial Infographic. The layout should feel like Vox, Bloomberg Originals, Netflix Documentary, or The Economist.\n\n"
                    "────────────────────────────\n"
                    "DESIGN SYSTEM & COLORS\n"
                    "────────────────────────────\n"
                    "Primary Color: #0D1B2A | Secondary Color: #F4C542 | Accent Color: #D62828 | White: #FFFFFF\n"
                    "Typography: Strong modern headlines, large numbers, clean visual spacing, elegant layout configurations.\n\n"
                    "────────────────────────────\n"
                    "CAROUSEL STRUCTURE ENGINE\n"
                    "────────────────────────────\n"
                    "Dynamically generate between 7 and 10 slides based on the story mode chosen (e.g. Explainer, Timeline, Comparison, etc.).\n"
                    "For each slide, you must define:\n"
                    "1. slide_number: Sequence number (starting from 1)\n"
                    "2. title: Strong main headline text\n"
                    "3. subtitle: Captivating context subtitle\n"
                    "4. key_message: The single takeaway sentence\n"
                    "5. visual_concept: Deep visual narrative describing what background image should show\n"
                    "6. layout: One of the supported layout templates: 'hero', 'comparison', 'statistics', 'quote', 'timeline', 'entity', 'conclusion'\n"
                    "7. entities_used: List of strings showing which referred_entities are in this slide\n"
                    "8. image_prompt: A detailed, highly descriptive prompt to feed into an image generator to produce the background graphic (cinematic lighting, print-quality, photorealistic or premium illustration, without text or overlays)\n\n"
                    "────────────────────────────\n"
                    "OUTPUT FORMAT\n"
                    "────────────────────────────\n"
                    "You must output the final deck in JSON matching the CarouselDeck schema exactly inside a single ```json ... ``` code block. JSON format:\n"
                    "{\n"
                    "  \"story_mode\": \"string\",\n"
                    "  \"theme\": \"string\",\n"
                    "  \"caption\": \"string\",\n"
                    "  \"slides\": [\n"
                    "    {\n"
                    "      \"slide_number\": 1,\n"
                    "      \"title\": \"string\",\n"
                    "      \"subtitle\": \"string\",\n"
                    "      \"key_message\": \"string\",\n"
                    "      \"visual_concept\": \"string\",\n"
                    "      \"layout\": \"hero\" | \"comparison\" | \"statistics\" | \"quote\" | \"timeline\" | \"entity\" | \"conclusion\",\n"
                    "      \"entities_used\": [\"string\"],\n"
                    "      \"image_prompt\": \"string\"\n"
                    "    }\n"
                    "  ]\n"
                    "}"
                )
                
                log_info("Orchestrating creative analysis with Gemini...")
                response = await agent.chat(prompt)
                response_text = await response.text()
                
                log_info("Parsing structured CarouselDeck response...")
                deck_dict = extract_json_block(response_text)
                deck = CarouselDeck.model_validate(deck_dict)
                
                log_info(f"Creative generation success for Theme: {deck.theme}")
                log_info(f"Copywriting Caption: {deck.caption}")
        except Exception as e:
            log_error(f"Failed to generate or validate CarouselDeck: {e}")
            update_instagram_post_db(post_id, "FAILED", [], error_message=f"Agent error: {str(e)}")
            continue

        # Update database record with parsed carousel_data
        update_instagram_post_db(post_id, "PENDING", [], carousel_data=deck.model_dump())
            
        # 4. Render each slide locally to JPEG
        log_info("Generating slides locally via Playwright...")
        slide_paths = []
        try:
            for slide in deck.slides:
                filename = f"slide_{target_signal_id}_{slide.slide_number}.jpg"
                output_path = os.path.join(OUTPUT_DIR, filename)
                
                # Generate background image using Gemini
                bg_filename = f"bg_{target_signal_id}_{slide.slide_number}.jpg"
                bg_path = os.path.join(OUTPUT_DIR, bg_filename)
                
                bg_success = generate_background_image(slide.image_prompt, bg_path)
                if not bg_success:
                    bg_path = None
                
                log_info(f"Rendering Slide {slide.slide_number}/{len(deck.slides)} -> {filename}")
                await render_slide_to_image(slide, len(deck.slides), output_path, bg_path)
                slide_paths.append((slide.slide_number, filename, output_path))
        except Exception as e:
            log_error(f"Failed during slide rendering: {e}")
            update_instagram_post_db(post_id, "FAILED", [], error_message=f"Rendering error: {str(e)}")
            continue
            
        # 5. Upload images directly to Supabase Storage
        log_info("Uploading slide images directly to Supabase Storage...")
        cdn_urls = []
        try:
            for slide_num, filename, local_path in slide_paths:
                public_url = upload_slide_to_storage(local_path, filename)
                log_info(f"Slide {slide_num} uploaded successfully: {public_url}")
                cdn_urls.append(public_url)
        except Exception as e:
            log_error(f"Failed to upload slide images: {e}")
            update_instagram_post_db(post_id, "FAILED", [], error_message=f"Upload error: {str(e)}")
            continue
            
        # 6. Publish to Instagram via Meta Graph API
        log_info("Publishing to Instagram...")
        post_status = "GENERATED"
        error_message = None
        instagram_media_id = None
        post_url = None
        
        if dry_run:
            log_info("Dry Run Mode Enabled: Skipping Meta API publishing stage.")
            post_status = "GENERATED"
        else:
            try:
                pub_res = publish_to_instagram(deck.caption, cdn_urls)
                if pub_res.get("success"):
                    post_status = "PUBLISHED"
                    instagram_media_id = pub_res.get("instagram_media_id")
                    post_url = pub_res.get("post_url")
                    log_info(f"Published successfully! Live link: {post_url}")
                elif pub_res.get("dry_run"):
                    post_status = "GENERATED"
                    log_info("Dry Run Mode: Slides created but Meta API publish skipped (missing credentials).")
                else:
                    post_status = "FAILED"
                    error_message = pub_res.get("error", "Unknown error")
                    log_error(f"Publishing failed: {error_message}")
            except Exception as e:
                log_error(f"Publishing exception: {str(e)}")
                post_status = "FAILED"
                error_message = str(e)
            
        # 7. Update database record with final details
        log_info(f"Updating database status to {post_status}...")
        update_instagram_post_db(
            post_id=post_id,
            status=post_status,
            media_urls=cdn_urls,
            instagram_media_id=instagram_media_id,
            post_url=post_url,
            error_message=error_message
        )
        log_info("=" * 60)
        log_info(f"Squirryfy Content Agent Run for Signal {target_signal_id} Completed Successfully.")
        log_info("=" * 60)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Squirryfy Instagram Creator Agent")
    parser.add_argument("--run-id", type=str, help="Optional specific discovery run ID to select signals from")
    parser.add_argument("--signal-id", type=str, help="Optional specific signal ID to process")
    parser.add_argument("--dry-run", action="store_true", help="Generate slides and upload images, but do not publish to live Instagram feed")
    args = parser.parse_args()
    
    asyncio.run(run_agent(run_id=args.run_id, signal_id=args.signal_id, dry_run=args.dry_run))
