from pydantic import BaseModel, Field
from typing import List

class SlideConfig(BaseModel):
    slide_number: int = Field(description="Slide sequence starting from 1 (Hook slide)")
    title: str = Field(description="Title text to render on the slide")
    body: str = Field(description="Body or bullet points to render on the slide")
    bg_theme: str = Field(description="Background theme styling (e.g., 'dark-cyberpunk', 'neon-emerald', 'clean-minimal')")
    image_prompt: str = Field(description="Detailed image generation prompt for the background or supporting graphic")
    layout_style: str = Field(description="Specific layout instructions: 'centered', 'left-split', 'two-column', 'bottom-docked'")

class CarouselDeck(BaseModel):
    signal_id: str
    caption: str = Field(description="Captivating Instagram post caption with formatted text and relevant hashtags")
    slides: List[SlideConfig] = Field(description="List of slides. Must be exactly 5 to 7 slides.")
