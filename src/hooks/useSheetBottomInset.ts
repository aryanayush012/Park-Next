import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';

/**
 * Bottom padding for a sheet that sits flush against the bottom of the
 * screen inside a `Modal`.
 *
 * A `Modal` renders in its own native window, outside the app's normal view
 * tree, so nothing applies the system inset for it the way `SafeAreaView`
 * does on a screen. A fixed padding therefore looks fine on a handset with
 * gesture navigation and clips on one with a three-button bar — Samsung's
 * is around 48dp — hiding whatever sits last in the sheet.
 *
 * `useSafeAreaInsets` still works in here because the provider's value
 * travels by React context, which crosses the Modal boundary even though
 * the native hierarchy does not.
 *
 * @param minimum Padding to use when the device reports no inset at all, so
 *   the sheet never sits flush against the screen edge.
 */
export function useSheetBottomInset(minimum: number = spacing.xl): number {
  const insets = useSafeAreaInsets();
  // A little breathing room above the bar itself, rather than the content
  // stopping exactly where the system UI begins.
  return Math.max(insets.bottom + spacing.sm, minimum);
}
