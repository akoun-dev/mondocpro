#!/usr/bin/env python3
"""Task 36 — Génère les assets natifs Android (icônes adaptives + splash)
à partir de public/img/logo.png, pour consommation par @capacitor/assets
(`npx capacitor-assets generate --android`).

Sorties dans assets/ :
  - icon-only.png        1024×1024 (source icône classique)
  - icon-foreground.png  1024×1024 (avant-plan adaptatif, logo dans la zone sûre 66 %)
  - icon-background.png  1024×1024 (fond uni blanc)
  - splash.png           2732×2732 (fond bleu marque + logo sur badge blanc)
  - splash-dark.png      2732×2732 (variante sombre)
"""
from PIL import Image

BRAND = (21, 101, 192)  # #1565c0 — primary globals.css
BRAND_DARK = (13, 71, 161)  # #0d47a1 — primary-dark
WHITE = (255, 255, 255)

LOGO = "public/img/logo.png"
OUT = "assets"

logo = Image.open(LOGO).convert("RGBA")


def center_resize(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


# ——— Icône seule (1024) : logo plein cadre ———
icon_only = center_resize(logo, 1024)
icon_only.save(f"{OUT}/icon-only.png")

# ——— Icône adaptive : avant-plan = logo à 62 % (zone sûre Android ~66 %),
#      fond = blanc uni — look « badge médical » propre ———
fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
logo_fg = center_resize(logo, 635)  # 1024 * 0.62
fg.alpha_composite(logo_fg, ((1024 - 635) // 2, (1024 - 635) // 2))
fg.save(f"{OUT}/icon-foreground.png")

bg = Image.new("RGBA", (1024, 1024), WHITE + (255,))
bg.save(f"{OUT}/icon-background.png")

# ——— Splash 2732 : fond marque + badge blanc centré (miroir du chargement
#      brandé de src/app/page.tsx) + logo ———
for name, fill in (("splash", BRAND), ("splash-dark", BRAND_DARK)):
    splash = Image.new("RGBA", (2732, 2732), fill + (255,))
    badge = Image.new("RGBA", (2732, 2732), (0, 0, 0, 0))
    circle_d = 900
    mask = Image.new("L", (circle_d, circle_d), 0)
    from PIL import ImageDraw

    ImageDraw.Draw(mask).ellipse((0, 0, circle_d, circle_d), fill=255)
    white = Image.new("RGBA", (circle_d, circle_d), WHITE + (255,))
    badge.paste(white, ((2732 - circle_d) // 2, (2732 - circle_d) // 2), mask)
    splash.alpha_composite(badge)
    logo_splash = center_resize(logo, 620)
    splash.alpha_composite(
        logo_splash, ((2732 - 620) // 2, (2732 - 620) // 2)
    )
    splash.convert("RGB").save(f"{OUT}/{name}.png")

print("Assets générés dans assets/ : icon-only, icon-foreground, icon-background, splash, splash-dark")
