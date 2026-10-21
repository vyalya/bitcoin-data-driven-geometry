# Interface refinement and follow-up

## Implemented

- Atom / Classic toggle, orange block teeth and rings, charcoal Atom background, restrained glow and subtle decorative atmosphere.
- A shared neutral palette for both side panes; tabular numbers and explicit geometry labels for seven core measurements.
- Exact per-block inspector above the overview on hover; tap/click pinning, Previous / Next and explorer verification links.
- Wider invisible tooth hit targets, small point-hit tolerance, refreshed instance bounds, stable pin identity per block.
- Separate canvas lifetimes for grid/detail, fresh style scenes, complete camera resets, close smooth zoom and Reset view.
- A dedicated visualization viewport; responsive 2/3/5-column grid; mobile safe-area spacing, top controls and collapsible bottom sheet.
- Hide panels retains Grid, Play and Orbit while widening the scene.
- Compact About, Legend, Guide and Sources pages. Legend uses the actual fourth-halving geometry with labels and a selectable definition for each signal. Topics fit the modal instead of requiring a long scrolling page.
- Removed per-frame React updates of the entire grid; transforms and motion remain in the renderer.

## Validation limits

Node tests exercise real Three.js raycasts, instance transforms, camera projection and source arithmetic. They do not replace browser interaction, device/GPU performance or accessibility testing. Saved browser access restrictions still prevent automated rendered-layout testing. User screenshots exposed stale scene objects and header crowding; the current fixes must be evaluated after a full reload.

## Next useful improvements

1. Synchronized two-date comparison with shared scales and absolute/percentage differences; handle zero/missing baselines explicitly.
2. Shareable URLs for selected date, presentation mode, metric and camera framing.
3. Captioned still-image exports with release date, data scales and source links.
4. Accessible HTML data table and a complete keyboard/focus audit, including the guide dialog.
5. Profile on actual mobile hardware; consider lazy-loading postprocessing and cached grid thumbnails. The current JS bundle remains about 337 KB gzip, with a Vite chunk-size warning.

Do not introduce era-relative normalization without persistent labeling: it would change the interpretation of comparisons across dates.
