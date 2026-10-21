# Jetpack Jones 🚀🕹️

An authentic retro 2.5D sci-fi action platformer and shooter built for desktop and mobile browsers with **Three.js**, **WebGL**, **TypeScript**, and **Vite**.

Inspired by 1970s/1980s vintage astronaut action figures (Captain Action, Major Matt Mason) and classic arcade cabinet side-scrollers.

---

## 🎮 Play & Controls

### Desktop (Keyboard & Mouse)
* **[Space]** / **[W]** / **[Up Arrow]**: Fire Jetpack Thrusters (hold for sustained lift, tap for hover buoyancy)
* **[S]** / **[Down Arrow]**: Quick Dive / Descent
* **[J]** / **[Enter]** / **[Left Click]**: Fire Raygun Blaster
* **Audio Button (Top Right)**: Toggle 80s arcade sound synthesizer

### Mobile / Tablet Touchscreen
* **Left Screen / 🔥 THRUST button**: Hold to activate jetpack
* **Right Screen / ⚡ BLASTER button**: Tap to fire laser blaster

### Gamepads
* Fully supports standard Bluetooth & USB gamepads (Xbox, PlayStation, etc.):
  * **Button A / R2**: Jetpack Thruster
  * **Button X / B**: Raygun Blaster
  * **D-Pad Down**: Dive

---

## 🛠️ Features & Clever Techniques

1. **2.5D Cinematic Aesthetic:**
   * 3D PBR materials (vacuum-metallized chrome jetpack, glossy molded action-figure PVC suit, amber bubble visor).
   * Parallax industrial background with multi-plane scaffolding and molten glowing conduits.
2. **Faux-Volumetric Smoke & Fire System:**
   * Camera-facing billboard particles with a custom fragment shader calculating **pseudo-spherical 3D normals**.
   * Real-time self-shading lit from the jetpack nozzle light.
   * Thermal color gradient: white-hot core (`#FFFFFF` to `#FFAA00`) → expanding amber combustion (`#FF5500`) → dense billowing terracotta & soot cloud (`#4A372D`).
   * Flying ember and spark trail with turbulent drag.
   * Dynamic `PointLight` attached to the thruster nozzle that flickers and illuminates passing gears, platforms, and Jones' suit.
3. **Obstacles & Mechanics:**
   * Rotating steel cogs with heavy mechanical gear teeth.
   * Timed crushing hydraulic pistons.
   * Destructible high-voltage plasma containment tubes (3 blaster shots to explode!).
   * Hazard catwalks with caution stripes.
   * Green Fuel Canisters and Golden Action Tokens.
4. **Built-in Web Audio Synthesizer:**
   * 100% procedurally synthesized 80s sound effects (thruster combustion roar, laser zaps, explosions, pick-up chimes) using the browser's native Web Audio API — zero external audio assets required.
5. **Authentic CRT Arcade Frame:**
   * Scanline overlay, screen curvature vignette, and segmented LED LIFE & FUEL gauges.

---

## 🚀 Deployment (GitHub & Vercel)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: Jetpack Jones 2.5D game"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/jetpack-jones.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your `jetpack-jones` repository.
3. Vercel automatically detects **Vite**:
   * **Framework Preset:** Vite
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. Click **Deploy**! Your game will be live with instant global CDN distribution.
