import os
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

def render_slide_html(slide: SlideConfig, total_slides: int) -> str:
    gradient = THEME_GRADIENTS.get(slide.bg_theme, THEME_GRADIENTS["dark-cyberpunk"])
    accent = THEME_ACCENTS.get(slide.bg_theme, THEME_ACCENTS["dark-cyberpunk"])
    
    # Render layout specific HTML
    layout_html = ""
    if slide.layout_style == "centered" or slide.slide_number == 1 or slide.slide_number == total_slides:
        # Title & main body centered
        layout_html = f"""
        <div class="centered-content">
            <h1 class="slide-title" style="color: {accent}; text-align: center;">{slide.title}</h1>
            <div class="slide-body centered-body">{slide.body}</div>
        </div>
        """
    elif slide.layout_style == "left-split":
        layout_html = f"""
        <div class="split-content">
            <div class="left-col">
                <h1 class="slide-title" style="color: {accent};">{slide.title}</h1>
            </div>
            <div class="right-col">
                <div class="slide-body">{slide.body}</div>
            </div>
        </div>
        """
    elif slide.layout_style == "two-column":
        # Split body or columns
        layout_html = f"""
        <div class="two-column-content">
            <h1 class="slide-title" style="color: {accent}; width: 100%; margin-bottom: 32px;">{slide.title}</h1>
            <div class="columns-wrapper">
                <div class="col-item slide-body">{slide.body}</div>
            </div>
        </div>
        """
    else: # bottom-docked
        layout_html = f"""
        <div class="docked-content">
            <h1 class="slide-title" style="color: {accent};">{slide.title}</h1>
            <div class="center-graphic">
                <div class="glowing-accent" style="background: {accent};"></div>
                <div class="graphic-label">{slide.image_prompt[:60]}...</div>
            </div>
            <div class="slide-body docked-body">{slide.body}</div>
        </div>
        """

    # Generate progress indicators
    dots_html = ""
    for i in range(1, total_slides + 1):
        active_class = "active" if i == slide.slide_number else ""
        dots_html += f'<div class="progress-dot {active_class}" style="background-color: {accent if i == slide.slide_number else "rgba(255,255,255,0.2)"};"></div>'

    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
        <style>
            * {{
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }}
            body {{
                width: 1080px;
                height: 1350px;
                background: {gradient};
                font-family: 'Inter', sans-serif;
                color: #ffffff;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding: 80px 64px;
                position: relative;
                overflow: hidden;
            }}
            /* Glow effects */
            body::before {{
                content: '';
                position: absolute;
                width: 600px;
                height: 600px;
                border-radius: 50%;
                background: {accent};
                opacity: 0.08;
                filter: blur(120px);
                top: -100px;
                right: -100px;
                pointer-events: none;
            }}
            body::after {{
                content: '';
                position: absolute;
                width: 500px;
                height: 500px;
                border-radius: 50%;
                background: {accent};
                opacity: 0.05;
                filter: blur(100px);
                bottom: -150px;
                left: -150px;
                pointer-events: none;
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
                gap: 8px;
            }}
            .brand-dot {{
                width: 10px;
                height: 10px;
                background-color: {accent};
                border-radius: 50%;
                box-shadow: 0 0 12px {accent};
            }}
            .slide-tag {{
                font-size: 14px;
                font-weight: 600;
                letter-spacing: 2px;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.4);
            }}
            
            /* Main Content Card (Glassmorphic) */
            .main-card {{
                background: rgba(255, 255, 255, 0.02);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 32px;
                padding: 64px 48px;
                flex-grow: 1;
                margin-top: 40px;
                margin-bottom: 40px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                z-index: 5;
            }}
            
            /* Typography */
            .slide-title {{
                font-family: 'Outfit', sans-serif;
                font-size: 48px;
                font-weight: 800;
                line-height: 1.2;
                margin-bottom: 32px;
                letter-spacing: -1px;
            }}
            .slide-body {{
                font-size: 24px;
                line-height: 1.6;
                color: #e5e7eb;
            }}
            .slide-body ul {{
                margin-left: 28px;
            }}
            .slide-body li {{
                margin-bottom: 16px;
            }}
            
            /* Layout: Centered */
            .centered-content {{
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
            }}
            .centered-body {{
                text-align: center;
                max-width: 800px;
            }}
            
            /* Layout: Split */
            .split-content {{
                display: flex;
                align-items: center;
                gap: 40px;
                height: 100%;
            }}
            .left-col {{
                flex: 1;
            }}
            .right-col {{
                flex: 1.2;
            }}
            
            /* Layout: Two Column */
            .two-column-content {{
                display: flex;
                flex-direction: column;
                height: 100%;
            }}
            .columns-wrapper {{
                display: flex;
                gap: 32px;
                flex-grow: 1;
            }}
            .col-item {{
                flex: 1;
            }}
            
            /* Layout: Docked */
            .docked-content {{
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                height: 100%;
            }}
            .center-graphic {{
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                margin: 24px 0;
                position: relative;
            }}
            .glowing-accent {{
                width: 140px;
                height: 140px;
                border-radius: 30px;
                opacity: 0.15;
                filter: blur(24px);
                position: absolute;
            }}
            .graphic-label {{
                font-size: 16px;
                font-style: italic;
                color: rgba(255, 255, 255, 0.4);
                text-align: center;
                max-width: 600px;
                border: 1px dashed rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                padding: 16px;
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
                transition: all 0.3s ease;
            }}
            .progress-dot.active {{
                width: 24px;
                border-radius: 5px;
            }}
            .action-hint {{
                font-size: 14px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.5);
                display: flex;
                align-items: center;
                gap: 8px;
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

async def render_slide_to_image(slide: SlideConfig, total_slides: int, output_path: str):
    html_content = render_slide_html(slide, total_slides)
    async with async_playwright() as p:
        # Launch browser in headless mode
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1080, "height": 1350})
        await page.set_content(html_content)
        # Wait a small duration for fonts to render
        await asyncio.sleep(0.5)
        # Capture screenshot with high quality
        await page.screenshot(path=output_path, type="jpeg", quality=95)
        await browser.close()
