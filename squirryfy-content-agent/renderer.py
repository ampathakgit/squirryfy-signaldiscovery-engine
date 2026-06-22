import os
import re
import asyncio
from playwright.async_api import async_playwright
from schemas import SlideConfig

THEME_GRADIENTS = {
    "dark-cyberpunk": "linear-gradient(135deg, #0b071e 0%, #05040e 100%)",
    "neon-emerald": "linear-gradient(135deg, #040d0a 0%, #010403 100%)",
    "clean-minimal": "linear-gradient(135deg, #121214 0%, #000000 100%)",
    "royal-gold": "linear-gradient(135deg, #1c150c 0%, #0b0805 100%)",
    "blue-gradient": "linear-gradient(135deg, #091726 0%, #040910 100%)",
}

THEME_ACCENTS = {
    "dark-cyberpunk": "#d946ef", # Neon Pink / Magenta
    "neon-emerald": "#10b981", # Emerald
    "clean-minimal": "#f3f4f6", # Cool White
    "royal-gold": "#fbbf24", # Gold
    "blue-gradient": "#3b82f6", # Blue
}

def render_slide_html(slide: SlideConfig, total_slides: int, bg_path: str = None) -> str:
    # Editorial Colors
    primary_color = "#0D1B2A"
    secondary_color = "#F4C542"
    accent_color = "#D62828"
    white = "#FFFFFF"

    # Resolve background styling
    if bg_path and os.path.exists(bg_path):
        import base64
        try:
            with open(bg_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            bg_data_url = f"data:image/jpeg;base64,{encoded_string}"
            background_style = f"background-image: linear-gradient(rgba(13, 27, 42, 0.75), rgba(13, 27, 42, 0.9)), url('{bg_data_url}'); background-size: cover; background-position: center;"
        except Exception as e:
            print(f"[Renderer Warning] Failed to convert background to base64: {e}")
            gradient = THEME_GRADIENTS.get("dark-cyberpunk")
            background_style = f"background: {gradient};"
    else:
        gradient = THEME_GRADIENTS.get("dark-cyberpunk")
        background_style = f"background: {gradient};"

    # Layout generation based on template selection
    layout_html = ""
    
    if slide.layout == "hero":
        layout_html = f"""
        <div class="hero-template">
            <div class="hero-top">
                <span class="hero-kicker">{slide.subtitle}</span>
                <h1 class="hero-title">{slide.title}</h1>
            </div>
            <div class="hero-bottom">
                <div class="hero-divider"></div>
                <p class="hero-message">{slide.key_message}</p>
            </div>
        </div>
        """
    elif slide.layout == "comparison":
        layout_html = f"""
        <div class="comparison-template">
            <h2 class="template-title">{slide.title}</h2>
            <p class="template-subtitle">{slide.subtitle}</p>
            <div class="comparison-wrapper">
                <div class="comparison-card left-card">
                    <div class="card-tag">ANALYSIS</div>
                    <p>{slide.key_message}</p>
                </div>
                <div class="comparison-card right-card">
                    <div class="card-tag accent-tag">CONCEPT</div>
                    <p>{slide.visual_concept}</p>
                </div>
            </div>
        </div>
        """
    elif slide.layout == "statistics":
        # Extract first number or percentage found in title/subtitle/key_message
        stat_match = re.search(r'(\d+(?:\.\d+)?%|\d+(?:\.\d+)?[B|M|K]|\d+,\d+|\d+)', slide.title + " " + slide.subtitle + " " + slide.key_message)
        stat_val = stat_match.group(1) if stat_match else "10x"
        
        # Clean stat from title if matched to keep layout clean
        clean_title = slide.title
        if stat_match and stat_val in clean_title:
            clean_title = clean_title.replace(stat_val, "").strip()
            if clean_title.startswith("/") or clean_title.startswith("-"):
                clean_title = clean_title[1:].strip()
                
        layout_html = f"""
        <div class="statistics-template">
            <div class="stat-number-wrapper">
                <div class="stat-number">{stat_val}</div>
                <div class="stat-decorator"></div>
            </div>
            <h2 class="stat-title">{clean_title}</h2>
            <p class="stat-subtitle">{slide.subtitle}</p>
            <p class="stat-message">{slide.key_message}</p>
        </div>
        """
    elif slide.layout == "quote":
        layout_html = f"""
        <div class="quote-template">
            <span class="quote-mark">“</span>
            <p class="quote-text">{slide.key_message}</p>
            <div class="quote-attribution">
                <span class="attribution-line"></span>
                <span class="attribution-name">{slide.title}</span>
            </div>
            <p class="quote-sub">{slide.subtitle}</p>
        </div>
        """
    elif slide.layout == "timeline":
        # Split key message into timeline steps by common delimiters
        steps = [s.strip() for s in re.split(r'[•\n\r\-\*]+', slide.key_message) if s.strip()]
        if not steps:
            steps = [slide.subtitle, slide.key_message]
            
        steps_html = ""
        for idx, step in enumerate(steps[:4]): # Limit to 4 steps to maintain visual spacing
            active_style = "active-step" if idx == 0 else ""
            steps_html += f"""
            <div class="timeline-step {active_style}">
                <div class="step-marker-col">
                    <div class="step-dot"></div>
                    <div class="step-line"></div>
                </div>
                <div class="step-content">
                    <p>{step}</p>
                </div>
            </div>
            """
            
        layout_html = f"""
        <div class="timeline-template">
            <h2 class="template-title">{slide.title}</h2>
            <p class="template-subtitle">{slide.subtitle}</p>
            <div class="timeline-steps">
                {steps_html}
            </div>
        </div>
        """
    elif slide.layout == "entity":
        entities_html = ""
        for ent in slide.entities_used[:3]: # Limit to 3 entities
            entities_html += f"""
            <div class="entity-badge-card">
                <div class="entity-badge-header">
                    <span class="badge-icon"></span>
                    <span class="badge-title">{ent}</span>
                </div>
            </div>
            """
        layout_html = f"""
        <div class="entity-template">
            <h2 class="template-title">{slide.title}</h2>
            <p class="template-subtitle">{slide.subtitle}</p>
            <div class="entity-cards-wrapper">
                {entities_html}
            </div>
            <p class="entity-takeaway">{slide.key_message}</p>
        </div>
        """
    else: # conclusion
        layout_html = f"""
        <div class="conclusion-template">
            <h2 class="conclusion-title">{slide.title}</h2>
            <div class="conclusion-box">
                <p class="conclusion-highlight">{slide.subtitle}</p>
                <p class="conclusion-body">{slide.key_message}</p>
            </div>
            <div class="conclusion-cta">
                Swipe left to share your thoughts
            </div>
        </div>
        """

    # Generate progress indicators
    dots_html = ""
    for i in range(1, total_slides + 1):
        active_class = "active" if i == slide.slide_number else ""
        dots_html += f'<div class="progress-dot {active_class}"></div>'

    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700;800&family=Playfair+Display:ital,wght@0,600;0,800;1,600&display=swap" rel="stylesheet">
        <style>
            * {{
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }}
            body {{
                width: 1080px;
                height: 1350px;
                {background_style}
                font-family: 'Inter', sans-serif;
                color: {white};
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding: 80px 80px;
                position: relative;
                overflow: hidden;
            }}
            
            /* Glassmorphic main container */
            .main-card {{
                background: rgba(13, 27, 42, 0.6);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 40px;
                padding: 80px 64px;
                flex-grow: 1;
                margin-top: 40px;
                margin-bottom: 40px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                z-index: 5;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
            }}

            /* Header */
            .header {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
                z-index: 10;
            }}
            .brand {{
                font-family: 'Outfit', sans-serif;
                font-weight: 700;
                font-size: 24px;
                letter-spacing: -0.5px;
                display: flex;
                align-items: center;
                gap: 10px;
                color: {white};
            }}
            .brand-dot {{
                width: 12px;
                height: 12px;
                background-color: {secondary_color};
                border-radius: 50%;
                box-shadow: 0 0 12px {secondary_color};
            }}
            .slide-tag {{
                font-size: 14px;
                font-weight: 600;
                letter-spacing: 2px;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.5);
            }}

            /* HERO TEMPLATE */
            .hero-template {{
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                height: 100%;
            }}
            .hero-kicker {{
                font-family: 'Outfit', sans-serif;
                text-transform: uppercase;
                letter-spacing: 3px;
                font-size: 18px;
                font-weight: 700;
                color: {secondary_color};
                margin-bottom: 16px;
                display: block;
            }}
            .hero-title {{
                font-family: 'Playfair Display', serif;
                font-size: 64px;
                font-weight: 800;
                line-height: 1.15;
                letter-spacing: -1.5px;
                color: {white};
            }}
            .hero-divider {{
                width: 80px;
                height: 5px;
                background: {accent_color};
                margin-bottom: 24px;
                border-radius: 2px;
            }}
            .hero-message {{
                font-size: 26px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.9);
                font-weight: 400;
            }}

            /* COMPARISON TEMPLATE */
            .comparison-template {{
                display: flex;
                flex-direction: column;
                height: 100%;
            }}
            .template-title {{
                font-family: 'Outfit', sans-serif;
                font-size: 42px;
                font-weight: 800;
                letter-spacing: -1px;
                margin-bottom: 12px;
            }}
            .template-subtitle {{
                font-size: 20px;
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 40px;
            }}
            .comparison-wrapper {{
                display: flex;
                gap: 24px;
                flex-grow: 1;
            }}
            .comparison-card {{
                flex: 1;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 24px;
                padding: 32px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                border-top: 4px solid {secondary_color};
            }}
            .comparison-card p {{
                font-size: 22px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.95);
            }}
            .card-tag {{
                font-family: 'Outfit', sans-serif;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 2px;
                color: {secondary_color};
                margin-bottom: 16px;
            }}
            .card-tag.accent-tag {{
                color: {accent_color};
            }}
            .right-card {{
                border-top: 4px solid {accent_color};
            }}

            /* STATISTICS TEMPLATE */
            .statistics-template {{
                display: flex;
                flex-direction: column;
                justify-content: center;
                height: 100%;
            }}
            .stat-number-wrapper {{
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 16px;
            }}
            .stat-number {{
                font-family: 'Outfit', sans-serif;
                font-size: 120px;
                font-weight: 800;
                line-height: 1;
                color: {secondary_color};
                letter-spacing: -2px;
            }}
            .stat-decorator {{
                width: 12px;
                height: 60px;
                background: {accent_color};
                border-radius: 6px;
            }}
            .stat-title {{
                font-family: 'Outfit', sans-serif;
                font-size: 38px;
                font-weight: 800;
                margin-bottom: 16px;
                line-height: 1.2;
            }}
            .stat-subtitle {{
                font-size: 20px;
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 24px;
            }}
            .stat-message {{
                font-size: 24px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.85);
            }}

            /* QUOTE TEMPLATE */
            .quote-template {{
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                height: 100%;
            }}
            .quote-mark {{
                font-family: 'Playfair Display', serif;
                font-size: 140px;
                line-height: 1;
                color: {accent_color};
                height: 60px;
                margin-bottom: -10px;
            }}
            .quote-text {{
                font-family: 'Playfair Display', serif;
                font-size: 36px;
                font-style: italic;
                line-height: 1.4;
                color: {white};
                margin-bottom: 40px;
                max-width: 800px;
            }}
            .quote-attribution {{
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 8px;
            }}
            .attribution-line {{
                width: 24px;
                height: 2px;
                background: {secondary_color};
            }}
            .attribution-name {{
                font-family: 'Outfit', sans-serif;
                font-size: 20px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: {secondary_color};
            }}
            .quote-sub {{
                font-size: 16px;
                color: rgba(255, 255, 255, 0.5);
            }}

            /* TIMELINE TEMPLATE */
            .timeline-template {{
                display: flex;
                flex-direction: column;
                height: 100%;
            }}
            .timeline-steps {{
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-top: 20px;
                flex-grow: 1;
                justify-content: center;
            }}
            .timeline-step {{
                display: flex;
                gap: 24px;
                opacity: 0.5;
                transition: opacity 0.3s ease;
            }}
            .timeline-step.active-step {{
                opacity: 1;
            }}
            .step-marker-col {{
                display: flex;
                flex-direction: column;
                align-items: center;
            }}
            .step-dot {{
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                border: 4px solid rgba(13, 27, 42, 1);
                z-index: 2;
            }}
            .active-step .step-dot {{
                background: {accent_color};
                box-shadow: 0 0 12px {accent_color};
            }}
            .step-line {{
                width: 2px;
                flex-grow: 1;
                background: rgba(255, 255, 255, 0.1);
                margin-top: -2px;
                margin-bottom: -10px;
            }}
            .timeline-step:last-child .step-line {{
                display: none;
            }}
            .step-content {{
                padding-bottom: 20px;
            }}
            .step-content p {{
                font-size: 22px;
                line-height: 1.4;
                color: rgba(255, 255, 255, 0.9);
            }}
            .active-step .step-content p {{
                font-weight: 500;
                color: {white};
            }}

            /* ENTITY TEMPLATE */
            .entity-template {{
                display: flex;
                flex-direction: column;
                height: 100%;
            }}
            .entity-cards-wrapper {{
                display: flex;
                gap: 16px;
                margin-bottom: 40px;
            }}
            .entity-badge-card {{
                flex: 1;
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 20px;
                padding: 24px;
                text-align: center;
            }}
            .entity-badge-header {{
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }}
            .badge-icon {{
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: {accent_color};
                box-shadow: 0 0 8px {accent_color};
            }}
            .badge-title {{
                font-family: 'Outfit', sans-serif;
                font-size: 18px;
                font-weight: 700;
                color: {white};
            }}
            .entity-takeaway {{
                font-size: 24px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.85);
            }}

            /* CONCLUSION TEMPLATE */
            .conclusion-template {{
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                height: 100%;
            }}
            .conclusion-title {{
                font-family: 'Outfit', sans-serif;
                font-size: 48px;
                font-weight: 800;
                line-height: 1.2;
                margin-bottom: 24px;
            }}
            .conclusion-box {{
                background: rgba(255, 255, 255, 0.02);
                border-left: 5px solid {accent_color};
                padding: 32px;
                border-radius: 0 24px 24px 0;
                margin-bottom: 40px;
            }}
            .conclusion-highlight {{
                font-family: 'Outfit', sans-serif;
                font-size: 24px;
                font-weight: 700;
                color: {secondary_color};
                margin-bottom: 12px;
            }}
            .conclusion-body {{
                font-size: 22px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.85);
            }}
            .conclusion-cta {{
                font-family: 'Outfit', sans-serif;
                font-size: 16px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 2px;
                color: rgba(255, 255, 255, 0.4);
                text-align: center;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                padding-top: 24px;
            }}

            /* Footer */
            .footer {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
                z-index: 10;
            }}
            .progress-container {{
                display: flex;
                gap: 8px;
            }}
            .progress-dot {{
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background-color: rgba(255,255,255,0.2);
                transition: all 0.3s ease;
            }}
            .progress-dot.active {{
                width: 28px;
                border-radius: 5px;
                background-color: {secondary_color};
                box-shadow: 0 0 10px {secondary_color};
            }}
            .action-hint {{
                font-family: 'Outfit', sans-serif;
                font-size: 14px;
                font-weight: 700;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.5);
                display: flex;
                align-items: center;
                gap: 10px;
                letter-spacing: 1px;
            }}
            .action-hint span {{
                font-size: 18px;
                color: {secondary_color};
            }}
        </style>
    </head>
    <body>
        <!-- Header -->
        <div class="header">
            <div class="brand">
                <div class="brand-dot"></div>
                Squirryfy TrendLab
            </div>
            <div class="slide-tag">Slide {slide.slide_number} of {total_slides}</div>
        </div>
        
        <!-- Content Card -->
        <div class="main-card">
            {layout_html}
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="progress-container">
                {dots_html}
            </div>
            <div class="action-hint">
                Swipe Left <span>→</span>
            </div>
        </div>
    </body>
    </html>
    """
    return html_template

async def render_slide_to_image(slide: SlideConfig, total_slides: int, output_path: str, bg_path: str = None):
    html_content = render_slide_html(slide, total_slides, bg_path)
    async with async_playwright() as p:
        # Launch browser in headless mode
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1080, "height": 1350})
        await page.set_content(html_content)
        # Wait a small duration for fonts and backgrounds to render
        await asyncio.sleep(0.8)
        # Capture screenshot with high quality
        await page.screenshot(path=output_path, type="jpeg", quality=95)
        await browser.close()
