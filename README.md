# GG2Hero

A browser-based Guitar Hero 2-style rhythm game built with vanilla JavaScript, HTML5 Canvas, and Web Audio API.

## 🎮 Overview

GG2Hero is a rhythm game where players hit notes in sync with music by pressing keys or using a game controller. The game features multiple difficulty levels, star power mechanics, a pause system, and configurable controller bindings.

## ✨ Features

### Core Gameplay
- **Multiple Difficulty Levels**: Easy, Medium, Hard, and Expert modes
- **Real-time Note Rendering**: Smooth animation of falling notes on the fretboard
- **Score System**: Dynamic scoring with combo multipliers
- **Rock Meter**: Tracks player performance and affects success/failure
- **Star Power System**: Activates after collecting star phrases for 2x score multiplier and rock meter boost

### Game Modes
- **Quick Play**: Play single songs with selectable difficulty
- **Training Mode**: Practice mode with procedurally generated notes
- **Local Multiplayer**: Split-screen 2-4 player gameplay (In Development)
- **Private Battle**: Competitive battle mode (In Development)

### Audio & Visuals
- **OGG Audio Format**: Optimized audio streaming for browser performance
- **Dynamic HUD**: Real-time display of score, combo, multiplier, rock meter, and star power
- **Star Notes**: Special notes marked with cyan glow and yellow star fill
- **Pause Overlay**: Full-screen pause menu with resume and quit options

### Controls
- **Keyboard**: WASD + JK for note lanes, Space for star power
- **Controller Support**: Full gamepad support with remappable button bindings
- **Configurable Bindings**: Remap controller buttons per lane in Settings

## 🔧 Recent Changes (v01.00.10)

### Star Power System Improvements
- **Refined Activation Formula**: Star power now requires 50 points accumulated from star phrases
- **Reduced Phrase Frequency**: Star phrases appear every 5th note group (20% frequency, down from 33%)
- **Lower Gain Per Phrase**: Each completed phrase grants 10 points (down from 25)
- **Result**: Prevents constant star power activation; requires ~5 completed phrases to activate

### Visual Enhancements
- **Star Power Audio Feedback**: Ascending tone on activation (800Hz → 1200Hz over 150ms)
- **Enhanced Star Note Appearance**:
  - Bright cyan ring (#00ffff) with 12px glow shadow
  - Yellow star fill (#ffff00) for high visibility
  - Cyan outline (#00ccff) with 3px thickness
  - 1.15x outer radius for prominence
- **HUD Alignment**: Star power meter now aligns perfectly with rock meter using CSS grid layout

### Menu & UI Updates
- **New Menu Option**: "Private Battle (In Development)" added to main menu
- **Menu Structure**: 5 main options (Quick Play, Local Multiplayer, Private Battle, Training, Options)
- **In Development Notices**: Clear visual indication of features still in development

### Controller Configuration
- **Rebindable Buttons**: Players can customize controller button mappings in Settings
- **Per-Lane Configuration**: Configure binding for lanes ASD and JK individually
- **Persistent Storage**: Bindings saved in browser localStorage
- **Default Xbox Mapping**: Y, LB, RB, LA, X for lanes; LT for star power

### Code Quality
- **Audio Synthesis**: Safe Web Audio API usage with error handling
- **Dynamic Note Rendering**: Improved star note visual distinction
- **Grid Layout**: Consistent CSS grid for meter alignment

## 📋 Song List

Songs are defined in `songs.json` with the following structure:
```json
{
  "id": "song_name",
  "title": "Song Title",
  "artist": "Artist Name",
  "bpm": 120,
  "audioFile": "songs/song_name.ogg",
  "chartFile": "songs/song_name.chart"
}
```

### Supported Audio Format
- **OGG Vorbis** (.ogg): Recommended for optimal browser compatibility and file size

## 🎹 How to Play

### Keyboard Controls
- **Note Lanes**: A, S, D (left group), J, K (right group)
- **Star Power**: Space bar
- **Pause**: ESC key

### Gamepad Controls
- **Analog Stick / D-Pad**: Navigate menus
- **Button Presses**: Hit notes (customizable in Settings)
- **Star Power**: Default LT (customizable)

### Gameplay Mechanics
1. **Notes Fall**: Notes scroll down the fretboard from top to bottom
2. **Hit Windows**: Press the correct lane key when the note reaches the hit zone
3. **Combo Building**: Consecutive hits increase your combo and score multiplier
4. **Star Phrases**: Special note groups earn star power points
5. **Star Power**: Activates at 50 points; 2x multiplier for 16 seconds; boosts rock meter

## 🛠️ Installation & Setup

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Local web server (for proper audio file loading)

### Quick Start
1. Clone the repository:
   ```bash
   git clone https://github.com/chindc13/GG2Hero.git
   cd GG2Hero/browser-rhythm
   ```

2. Start a local server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx http-server
   ```

3. Open browser:
   ```
   http://localhost:8000
   ```

## 📁 Project Structure

```
browser-rhythm/
├── index.html          # Main HTML with UI, menus, and HUD
├── game.js             # Core game engine, rendering, and logic
├── style.css           # Styling for all UI elements and meters
├── songs.json          # Song metadata and chart file references
├── songs/              # Audio files (.ogg) and chart files (.chart)
├── assets/             # Game images and UI graphics
└── README.md           # This file
```

## 🎵 Adding New Songs

1. Prepare your song in OGG format: `songs/your_song.ogg`
2. Create a chart file: `songs/your_song.chart` (Guitar Hero .chart format)
3. Add entry to `songs.json`:
   ```json
   {
     "id": "your_song",
     "title": "Your Song Title",
     "artist": "Artist Name",
     "bpm": 120,
     "audioFile": "songs/your_song.ogg",
     "chartFile": "songs/your_song.chart"
   }
   ```
4. Refresh the game to see your new song in the song list

## ⚙️ Settings & Configuration

### In-Game Settings
- **Controller Configuration**: Remap gamepad buttons for each lane and star power
- **Difficulty Selection**: Choose Easy, Medium, Hard, or Expert
- **No Fail Mode**: Available in Quick Play (planned for Local Multiplayer)

### Browser Storage
- Controller bindings and settings are saved in browser localStorage
- Clear browser data to reset to default settings

## 🐛 Known Limitations

- **Local Multiplayer**: In Development - split-screen implementation not yet fully optimized
- **Input Routing**: Keyboard input globally routed (affects 4-player keyboard gameplay)
- **Star Power Sustain**: Sustain notes during star power not yet fully implemented
- **Private Battle**: Competitive features not yet available

## 📈 Performance Notes

- Optimized for 60 FPS gameplay
- OGG audio format reduces file size by ~70% compared to MP3
- Canvas rendering optimized for smooth note animation
- Efficient note culling prevents rendering off-screen notes

## 🎓 Game Difficulty Levels

| Level | Description | Note Speed | Multiplier |
|-------|-------------|-----------|-----------|
| Easy | Great for beginners | Slow | 1x |
| Medium | Intermediate players | Normal | 2x |
| Hard | Experienced players | Fast | 3x |
| Expert | Master difficulty | Very Fast | 4x |

## 🚀 Future Enhancements

- [ ] Full Local Multiplayer split-screen optimization
- [ ] Private Battle competitive features
- [ ] Extended visual effects during star power active phase
- [ ] Additional difficulty modifiers
- [ ] Leaderboard system
- [ ] Custom song support with automatic .chart generation
- [ ] Accessibility features (colorblind modes, adjustable speeds)

## 📝 Credits

**GG2Hero** - A Guitar Hero 2-inspired browser rhythm game created as a fan project.

Built with:
- Vanilla JavaScript (ES6+)
- HTML5 Canvas for rendering
- Web Audio API for audio synthesis
- GamePad API for controller support

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

This is a personal project. Feel free to fork and create your own version!

## 📞 Support

For issues or feature requests, please check the GitHub repository issues page.

---

**Version**: v01.00.10  
**Last Updated**: October 31, 2026  
**Status**: In Active Development