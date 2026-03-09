# Save Spritesheet Instructions

## Step 1: Save the Image
1. Right-click on the spritesheet image you attached in the chat
2. Select "Save Image As..."
3. Save it as exactly: `character_spritesheet.png`
4. Save location: `/Users/erichaynes/Desktop/Development/rpg-starter/`

## Step 2: Refresh the Game
Once the image is saved in the correct location, refresh your browser to see the sprite character!

## Current Configuration
The sprite system is configured with these defaults:
- Frame size: 64x64 pixels
- Animations:
  - **Idle**: Row 0, 6 frames, speed 10
  - **Walk**: Row 1, 8 frames, speed 8
  - **Slash** (attack): Row 2, 6 frames, speed 5
  - **Spellcast**: Row 3, 7 frames, speed 6
  - **Hurt**: Row 4, 4 frames, speed 4

## Adjusting Configuration
If the animations don't line up correctly, you can adjust the `SPRITE_CONFIG` in rpg.js (around line 32):

```javascript
const SPRITE_CONFIG = {
  frameWidth: 64,  // Change this if frames are different size
  frameHeight: 64, // Change this if frames are different size
  animations: {
    idle: { row: 0, frames: 6, speed: 10 },      // Which row, how many frames
    walk: { row: 1, frames: 8, speed: 8 },
    slash: { row: 2, frames: 6, speed: 5 },
    spellcast: { row: 3, frames: 7, speed: 6 },
    hurt: { row: 4, frames: 4, speed: 4 }
  }
};
```

## What Changed
1. ✅ Added sprite loading system
2. ✅ Added sprite animation frame calculator
3. ✅ Modified drawCharacter() to use sprites when available
4. ✅ Falls back to drawn shapes if sprite doesn't load
5. ✅ Equipment (weapons/shields) still render on top of sprite
6. ✅ Attack animations trigger "slash" sprite animation
7. ✅ Spell casting triggers "spellcast" sprite animation
8. ✅ Walking triggers "walk" sprite animation
9. ✅ Standing still uses "idle" sprite animation

The system will automatically detect if the sprite loads successfully and use it, otherwise it will use the original drawn character as a fallback!
