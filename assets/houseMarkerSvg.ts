/**
 * The little amber house that marks a parking spot on the map.
 *
 * Drawn in the soft "clay" style of the reference render: a three-quarter
 * view built from flat planes, each with its own gradient, so the roof,
 * the lit wall and the shaded wall read as three faces of one solid rather
 * than as a flat icon. The rounded joins and the rim-light along the roof
 * ridge are what give it the moulded look.
 *
 * A string rather than an .svg file for the same reason as the car: this is
 * injected into the Leaflet WebView's DOM, and that page cannot reach the
 * app bundle's assets.
 */
export const HOUSE_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 96">
<defs>
  <linearGradient id="hmRoofL" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="#FFD873"/>
    <stop offset="0.55" stop-color="#FFC33F"/>
    <stop offset="1" stop-color="#F2A81C"/>
  </linearGradient>
  <linearGradient id="hmRoofR" x1="0" y1="0" x2="1" y2="0.7">
    <stop offset="0" stop-color="#F7B62B"/>
    <stop offset="1" stop-color="#D98E0C"/>
  </linearGradient>
  <linearGradient id="hmWallL" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFC94E"/>
    <stop offset="1" stop-color="#F0A81B"/>
  </linearGradient>
  <linearGradient id="hmWallR" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="#E9A21A"/>
    <stop offset="1" stop-color="#C8800A"/>
  </linearGradient>
  <linearGradient id="hmChimney" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFD061"/>
    <stop offset="1" stop-color="#E29A12"/>
  </linearGradient>
  <linearGradient id="hmGlass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#9AA3AF"/>
    <stop offset="0.5" stop-color="#6B7280"/>
    <stop offset="0.5" stop-color="#4A3B32"/>
    <stop offset="1" stop-color="#3A2E27"/>
  </linearGradient>
</defs>

<!-- Chimney, behind the roof so the ridge overlaps its base. -->
<rect x="62" y="4" width="17" height="26" rx="6" fill="url(#hmChimney)"/>

<!-- Roof: the lit plane facing us, then the shaded plane turning away. -->
<path d="M50,12 Q54,9 58,12 L99,45 Q103,49 99,53 Q95,56 91,53 L52,23 L13,53
         Q9,56 5,53 Q1,49 5,45 Z"
      fill="url(#hmRoofL)"/>
<path d="M52,20 L95,53 Q99,56 95,59 L74,59 Q70,59 68,56 L50,27 Z"
      fill="url(#hmRoofR)" opacity="0.92"/>

<!-- Rim light along the ridge — the single detail that sells "moulded". -->
<path d="M14,49 L51,20 Q53,18.5 55,20" stroke="#FFF0C2" stroke-opacity="0.75"
      stroke-width="3" fill="none" stroke-linecap="round"/>

<!-- Walls. -->
<path d="M14,52 L52,24 L52,86 Q52,90 48,90 L18,90 Q14,90 14,86 Z"
      fill="url(#hmWallL)"/>
<path d="M52,24 L90,52 L90,86 Q90,90 86,90 L56,90 Q52,90 52,86 Z"
      fill="url(#hmWallR)"/>

<!-- Windows on the lit wall. -->
<rect x="22" y="58" width="11" height="15" rx="3.5" fill="url(#hmGlass)"/>
<rect x="37" y="58" width="11" height="15" rx="3.5" fill="url(#hmGlass)"/>
<!-- Gable window on the shaded wall, set as a diamond. -->
<path d="M70,44 L77,51 L70,58 L63,51 Z" fill="url(#hmGlass)"/>

<!-- Arched door. -->
<path d="M63,90 L63,74 Q63,66 71,66 Q79,66 79,74 L79,90 Z" fill="#E09A14"/>
<path d="M65.5,90 L65.5,75 Q65.5,68.5 71,68.5 Q76.5,68.5 76.5,75 L76.5,90 Z"
      fill="url(#hmGlass)"/>
<circle cx="74" cy="80" r="1.8" fill="#FFD873"/>
</svg>
`;
