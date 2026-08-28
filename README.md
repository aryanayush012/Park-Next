# ParkNext

A peer-to-peer parking-space rental marketplace: people with a private parking spot (home or society/apartment allotment) list it for hourly rent; drivers find nearby spots on a map, book, and get directions. Built with Expo (React Native + TypeScript).

Runs today with **zero setup and zero cost** — no card, no API keys, no backend required. It works entirely on built-in mock data out of the box.

## Quick start

```bash
npm install
npx expo start
```

Then press `a` for an Android emulator, `i` for iOS simulator, or scan the QR code with the **Expo Go** app on your own phone (fastest way to see it on a real device).

## What's built

- **Renter flow**: onboarding, email OTP sign-in, map-based search (OpenStreetMap, no Google Maps/no card needed), listing detail, three booking types (instant / advance / recurring), booking confirmation with turn-by-turn directions, live check-in/check-out timer, booking history.
- **Provider flow**: dashboard, a 3-step add-listing wizard (details & location → amenities & photos → pricing & availability) with tap-to-place-pin location picking, listing review & publish, manage listings (active/inactive), accept/decline incoming booking requests.
- **Design system**: a premium, dark-first theme (colors, type, spacing, elevation) and a reusable component library, matching the Figma designs from Phase 2.
- **Backend-ready**: a complete Supabase/Postgres schema (with a database-level constraint that makes double-booking a spot impossible) sits in `supabase/`, and the app automatically switches from mock data to that real backend the moment you add credentials — see `supabase/README.md`. No code changes needed either way.

## Project structure

```
src/
  theme/        design tokens (colors, typography, spacing, elevation)
  components/   reusable UI (Button, TextField, OTPInput, ListingCard, MapView, ...)
  navigation/   React Navigation stacks/tabs for renter + provider flows
  screens/      auth/, renter/, provider/ screens
  data/         mock data + DataSource interface + SupabaseDataSource
  types/        shared TypeScript types
supabase/
  migrations/   SQL schema (run these when you're ready for a real backend)
  README.md     step-by-step Supabase setup guide
```

## Switching on the real backend (optional, whenever you're ready)

Everything above runs on mock data by default. When you want real accounts, real listings, and real bookings instead of sample data, follow `supabase/README.md` — it's a free Supabase project (no card), a handful of SQL scripts to paste into their editor, and two values pasted into a `.env` file. Nothing else changes.

## Notes on this build

- No payment gateway is integrated — by design. The renter pays the owner directly (cash/UPI); the app shows prices and, for metered listings, the computed amount owed based on check-in/check-out time.
- Maps use OpenStreetMap tiles via a WebView (Leaflet), not `react-native-maps`, specifically to avoid Google's requirement of a credit card on file for its Maps API.
- Auth is email-based OTP (not phone SMS) — see the Phase 1 requirements doc for why phone OTP has no genuinely free path in India today.

## Next step: building an APK

This project hasn't been built into an installable `.apk` yet — that's the next phase. `npx expo start` above is for live development; producing a real APK you can install on a phone will use either Expo's EAS Build service or a local Android SDK/Gradle build, covered separately.
