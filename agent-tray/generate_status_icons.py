from PIL import Image, ImageDraw

# Status colors
COLORS = {
    "green": (46, 204, 113, 255),    # Online
    "yellow": (241, 196, 15, 255),   # Registering
    "red": (231, 76, 60, 255),       # Offline
}

SIZE = 512
PADDING = 32

for name, color in COLORS.items():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((PADDING, PADDING, SIZE-PADDING, SIZE-PADDING), fill=color)
    img.save(f"icon-{name}.png")

print("Generated icon-green.png, icon-yellow.png, icon-red.png")
