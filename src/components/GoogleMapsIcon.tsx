import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Google Maps' pin, for the button that hands navigation over to it.
 *
 * Its own colours rather than the app's amber, for the same reason the
 * Google sign-in button stays white: it names another product, and a
 * recoloured version of someone's mark reads as a knock-off. It is drawn
 * simply — a pin and a dot in Maps' four colours — rather than tracing the
 * official artwork.
 */
export interface GoogleMapsIconProps {
  size?: number;
}

export function GoogleMapsIcon({ size = 20 }: GoogleMapsIconProps) {
  return (
<Svg width={size} height={size} viewBox="0 0 92.3 132.3">
  {/* Pin Color Segments */}
  <Path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
  <Path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
  <Path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3" />
  <Path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3" />
  <Path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2" />

  {/* White Center Circle */}
  <Circle cx="46.2" cy="46.2" r="17.7" fill="#ffffff" />
</Svg>
  );
}
