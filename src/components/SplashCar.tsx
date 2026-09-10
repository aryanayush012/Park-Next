/**
 * The car that drives the splash animation open.
 *
 * This is a direct conversion of the top-down car SVG supplied for the splash --
 * same paths, same coordinates, same 358.85 x 789.36 viewBox, nose pointing up
 * (-Y), which is what `AnimatedSplash` assumes when it rotates the car onto the
 * road's tangent.
 *
 * One deliberate substitution: the source used five radial gradients that each
 * inherited their stops through `xlink:href` and were positioned with a
 * `gradientTransform` matrix. Stop inheritance is not part of react-native-svg's
 * gradient support, so each one is expressed here as the linear sheen it reads
 * as -- the source's own two stops (#f8ce00 -> #b79700) along the axis the
 * original gradient ran. At the ~20dp this renders at during the splash the two
 * are indistinguishable, and it removes any dependence on gradientTransform
 * behaviour across react-native-svg versions.
 *
 * The colours here belong to the supplied artwork, not to the app's palette, so
 * they are intentionally local rather than pulled from `theme/colors`.
 */
import React from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export const CAR_VIEWBOX = { width: 358.85, height: 789.36 };
/** Height / width of the source artwork -- used to size the car from its length. */
export const CAR_ASPECT = CAR_VIEWBOX.height / CAR_VIEWBOX.width;

type Props = { width: number; height: number };

export const SplashCar: React.FC<Props> = ({ width, height }) => (
  <Svg width={width} height={height} viewBox="0 0 358.85 789.36">
    <Defs>
      <LinearGradient id="pnCarBody" x1={0} y1={0} x2={0} y2={1}>
        <Stop offset={0} stopColor="#f8ce00" />
        <Stop offset={1} stopColor="#b79700" />
      </LinearGradient>
      <LinearGradient id="pnCarLeft" x1={0} y1={0} x2={1} y2={0}>
        <Stop offset={0} stopColor="#b79700" />
        <Stop offset={1} stopColor="#f8ce00" />
      </LinearGradient>
      <LinearGradient id="pnCarRight" x1={1} y1={0} x2={0} y2={0}>
        <Stop offset={0} stopColor="#b79700" />
        <Stop offset={1} stopColor="#f8ce00" />
      </LinearGradient>
    </Defs>

    {/* wheels, seen from above */}
    <Rect x={16.287} y={623.04} width={27.775} height={78.696} rx={8.5849} fill="#60585a" />
    <Rect x={311.29} y={613.04} width={27.775} height={78.696} rx={8.5849} fill="#60585a" />
    <Rect x={318.79} y={98.038} width={27.775} height={78.696} rx={8.5849} fill="#60585a" />
    <Rect x={8.6333} y={101.12} width={27.775} height={78.696} rx={8.5849} fill="#60585a" />

    {/* body */}
    <Path
      d="m178.73 782.98c-113.07 2.362-130.4-17.92-147.11-21.261-16.705-38.776-19.877-365.73-9.855-392.46 7.493-60.54-4.936-70.565-8.687-143.53-7.14-85.213 9.815-37.829-4.439-124.48 21.658-90.216-19.136-92.053 168.52-100.63 172.21 2.401 147.96 10.415 169.61 100.63-14.254 86.652 2.701 39.268-4.439 124.48-3.751 72.961-16.18 82.986-8.687 143.53 10.022 26.727 6.85 353.68-9.855 392.46-26.153 15.153-95.459 21.261-145.07 21.261z"
      fill="url(#pnCarBody)"
      stroke="#000"
      strokeWidth={1.33}
    />
    {/* flanks */}
    <Path
      d="m41.537 281.88s21.534 82.442 21.534 82.442 0 154.58-3.0758 157.15c-3.0771 2.5759-27.686 46.372-27.686 46.372s6.1517-280.81 9.2288-285.97z"
      fill="url(#pnCarLeft)"
    />
    <Path
      d="m318.84 276.88s-21.534 82.442-21.534 82.442 0 154.58 3.0758 157.15c3.0771 2.5759 27.686 46.372 27.686 46.372s-6.1517-280.81-9.2288-285.97z"
      fill="url(#pnCarRight)"
    />
    {/* bonnet */}
    <Path
      d="m37.198 44.521c-11.667 18.667-10.816 196.22 7.851 210.22 18.03-14.851 122.48-28.646 142.34-27.364 20.288-1.492 99.694 8.055 124.09 22.697 6.577 2.13 19.727-205.55 1.059-219.55-58.34-16.344-252.01-16.344-275.34 13.99z"
      fill="#f7ce00"
      stroke="#000"
      strokeOpacity={0.46}
      strokeWidth={1.33}
    />
    {/* windscreen */}
    <Path
      d="m41.764 257.39s65.53-26.897 138.64-27.585c65.833-0.64088 95.565 9.623 135.61 25.019-4.8534 48.756-9.7078 94.943-21.843 110.34-111.64-28.23-118.92-28.23-230.56 0-2.43-15.39-24.273-105.21-21.846-107.77z"
      fill="url(#pnCarBody)"
    />
    <Path
      d="m45.51 260.2s63.783-24.762 134.95-25.395c64.078-0.59 93.017 8.859 132 23.033-4.724 44.885-9.449 87.405-21.261 101.58-108.67-25.986-115.75-25.985-224.42 0.001-2.362-14.174-23.623-96.856-21.261-99.218z"
      fill="#000"
      fillOpacity={0.7}
      stroke="#000"
      strokeWidth={1.33}
    />
    {/* rear window */}
    <Path
      d="m75.697 531.43c-12.369 59.368-22.263 173.16-22.263 173.16 19.79 17.316 121.21 24.737 123.69 24.737 7.4212 0 108.84-7.4212 126.16-32.158 0-14.842-9.8956-121.21-19.79-168.21-86.579 12.368-202.84 7.4212-207.79 2.4734z"
      fill="url(#pnCarBody)"
    />
    <Path
      d="m80.945 536.59c-11.812 56.695-21.261 165.36-21.261 165.36 18.899 16.536 115.75 23.623 118.12 23.623 7.087 0 103.94-7.087 120.48-30.71 0-14.174-9.45-115.75-18.899-160.64-82.681 11.811-193.71 7.087-198.44 2.362z"
      fill="#000"
      fillOpacity={0.79}
      stroke="#000"
      strokeWidth={1.33}
    />
    {/* mirrors */}
    <Path
      d="m321.9 279.09l28.348 2.362s14.174 14.174 4.725 21.261c-9.45 7.087-33.073-2.362-33.073-2.362v-21.261z"
      fill="#f7ce00"
      stroke="#000"
      strokeOpacity={0.55}
      strokeWidth={1.33}
    />
    <Path
      d="m36.946 283.82l-28.348 2.362s-14.174 14.174-4.725 21.261c9.45 7.087 33.073-2.362 33.073-2.362v-21.261z"
      fill="#f7ce00"
      stroke="#000"
      strokeOpacity={0.55}
      strokeWidth={1.33}
    />
    {/* headlamps */}
    <Path
      d="m52.582 17.025c-9.023 1.573-19.32 18.998-14.584 21.902 11.281-5.689 33.327-13.506 54.984-15.684 4.286-2.3 10.138-9.356 10.358-10.929-14.886-0.847-40.915 2.775-50.758 4.711z"
      fill="#2e87cf"
      fillOpacity={0.57}
      stroke="#000"
      strokeOpacity={0.25}
      strokeWidth={1.44}
    />
    <Path
      d="m298.7 12.115c9.0231 1.5731 19.32 14.633 14.584 17.537-11.28-5.6886-33.327-7.5051-54.984-9.6837-4.2855-2.2999-10.134-10.992-10.36-12.565 14.888-0.84719 40.917 2.7754 50.76 4.7115z"
      fill="#2e87cf"
      fillOpacity={0.57}
      stroke="#000"
      strokeOpacity={0.25}
      strokeWidth={1.44}
    />
    {/* window channels */}
    <Path
      d="m43.148 295.63s16.536 75.595 16.536 75.595 0 141.74-2.362 144.1c-2.363 2.362-21.261 42.521-21.261 42.521s4.724-257.49 7.087-262.22z"
      fill="#000"
      fillOpacity={0.69}
    />
    <Path
      d="m317.18 290.91s-16.536 75.595-16.536 75.595 0 141.74 2.362 144.1c2.363 2.362 21.261 42.521 21.261 42.521s-4.724-257.49-7.087-262.22z"
      fill="#000"
      fillOpacity={0.75}
    />
  </Svg>
);
