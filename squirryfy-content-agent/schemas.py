from pydantic import BaseModel, Field
from typing import List, Literal

class SlideConfig(BaseModel):
    slide_number: int = Field(description="Slide sequence starting from 1 (Hook slide)")
    title: str = Field(description="Title text to render on the slide")
    subtitle: str = Field(description="Subtitle text to render on the slide")
    key_message: str = Field(description="Key takeaway/message of the slide")
    visual_concept: str = Field(description="Description of the visual concept")
    layout: Literal["hero", "comparison", "statistics", "quote", "timeline", "entity", "conclusion"] = Field(
        description="The template layout style for this slide"
    )
    entities_used: List[str] = Field(default_factory=list, description="Entities highlighted in this slide")
    image_prompt: str = Field(description="Detailed image generation prompt for the background")

class CarouselDeck(BaseModel):
    story_mode: str = Field(description="Visual storytelling mode, e.g. 'MODE C: Explainer'")
    theme: str = Field(description="Core visual/content theme, e.g. 'Underdog Triumph'")
    caption: str = Field(description="Captivating Instagram post caption with formatted text and relevant hashtags")
    slides: List[SlideConfig] = Field(description="List of slides. Must be between 7 and 10 slides.")
