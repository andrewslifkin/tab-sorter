#!/usr/bin/env python3
"""Generate simple icon PNGs for the extension"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    # Create a rounded square icon with gradient
    img = Image.new('RGB', (size, size), color='#4285f4')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple grid pattern to represent organized tabs
    grid_color = '#ffffff'
    line_width = max(2, size // 32)
    padding = size // 6
    
    # Draw 3x3 grid of rectangles
    cell_size = (size - 2 * padding) // 3
    gap = cell_size // 4
    
    for row in range(3):
        for col in range(3):
            x = padding + col * (cell_size + gap // 3)
            y = padding + row * (cell_size + gap // 3)
            draw.rectangle(
                [x, y, x + cell_size - gap, y + cell_size - gap],
                fill=grid_color,
                outline=None
            )
    
    # Save with transparency for better look
    img = img.convert('RGBA')
    img.save(filename, 'PNG')
    print(f"Created {filename}")

# Create icons directory if it doesn't exist
os.makedirs('icons', exist_ok=True)

# Generate icons in required sizes
create_icon(16, 'icons/icon16.png')
create_icon(48, 'icons/icon48.png')
create_icon(128, 'icons/icon128.png')

print("All icons generated successfully!")
