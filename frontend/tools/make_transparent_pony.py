from pathlib import Path

from PIL import Image, ImageSequence


source = Path(__file__).parents[2] / "网页原型我在这" / "飞书图片" / "06_home_horse.gif"
target = Path(__file__).parents[1] / "assets" / "pony-transparent.gif"

image = Image.open(source)
frames = []
durations = []
for frame in ImageSequence.Iterator(image):
    rgba = frame.convert("RGBA")
    pixels = list(rgba.getdata())
    rgba.putdata([
        (r, g, b, 0) if r > 250 and g > 250 and b > 250 else (r, g, b, a)
        for r, g, b, a in pixels
    ])
    frames.append(rgba)
    durations.append(frame.info.get("duration", 80))

frames[0].save(
    target,
    save_all=True,
    append_images=frames[1:],
    loop=0,
    duration=durations,
    disposal=2,
    transparency=0,
)
