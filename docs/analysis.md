# FuelWards: why it matters and what the prototype lacks

FuelWards ("Fuel Rewards") is a crowdsourced fuel-price map for the Philippines. Drivers see current pump prices at nearby stations. They earn points for reporting price changes and redeem those points for fuel vouchers.

This document reviews the Figma prototype ([FUELWARDS](https://www.figma.com/design/mODm20NVwxDhimytGSUtUR/FUELWARDS)) as of 19 October 2026. It explains why the product is worth building and lists what has to change to turn the prototype into a working app.

## 1. Why FuelWards matters

### Prices change every week, and each station's price is different

- Fuel retail in the Philippines is deregulated under the Downstream Oil Industry Deregulation Act (RA 8479).
- Most of the country's oil is imported, so local prices follow the Mean of Platts Singapore (MOPS) benchmark.
- The Department of Energy (DOE) announces a weekly adjustment _range_. Each station's actual price still depends on delivery and transport costs.
- Oil companies often roll out an adjustment over two to three days. They don't always follow the DOE's estimate: in July 2026 some raised gasoline by ₱0.25/L even though the DOE had computed a possible rollback of up to ₱1.75/L.

### The swings are large and they hurt

- **July 2026:** diesel was expected to rise by about ₱10.68/L in a single week.
- **15 September 2026:** gasoline rose ₱5.68/L, diesel ₱4.31/L and kerosene ₱4.62/L. Some Metro Manila prices were heading above ₱100/L, and transport groups held a two-day strike.
- **August 2026:** the government raised the fuel discount for public utility vehicle (PUV) operators and drivers from ₱10 to ₱12 per litre.

At these prices, choosing the right station saves real money every week.

### Official data is too coarse to choose a station by

- The DOE publishes weekly ranges and periodic price monitoring, not live per-station prices.
- There's no current official consumer app.
- The DOE once paired with Angkas so riders could report pump prices, but that program ran only for a limited period.

### Existing community tools depend on goodwill

| Tool             | What it does                                                                                               | Weakness                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| MetroFuelTracker | Web map of about 1,500 Metro Manila stations with about 500 contributors. Requires GPS presence to submit. | Nobody is rewarded for contributing, and it covers Metro Manila only.  |
| GAS-PH           | Mobile app with community prices (upvotes) plus weekly DOE prices.                                         | DOE data covers Metro Manila only. Contributors get nothing in return. |
| Waze             | Shows some gas prices.                                                                                     | Prices are sparse and often stale in the Philippines.                  |

Crowdsourced data is only as good as the number of people who keep updating it. FuelWards adds what the others lack: **a reason to contribute.** Verified reports earn points that become fuel vouchers, so contributors directly benefit from keeping prices current.

### Who benefits

- **Private motorists**, who can find the cheapest fuel nearby.
- **PUV, jeepney and tricycle drivers**, who are the most price-sensitive. Diesel is their main cost.
- **Delivery and ride-hailing riders**, who already contributed price data under the DOE–Angkas program.
- **Fleets and small businesses**, which can plan refuelling around price changes.
- **The market as a whole.** Visible price differences push stations to compete.

## 2. What the current prototype lacks

### 2.1 Trust and data quality (most important)

The prototype gives points for typing a price, but nothing checks that the price is real. Rewards combined with unchecked input invite fake reports, and fake reports would destroy the map's usefulness.

Missing:

- A location check, so the reporter must be at the station.
- An optional photo of the price board.
- Confirmation by other users.
- Detection of outliers compared with nearby stations and the DOE weekly range.
- Rate limits on how often one person can report.
- Points that stay _pending_ until a report is verified.

Also missing: when each price was last updated, who reported it, a price history, and a comparison with the DOE bulletin.

### 2.2 Features that are missing or don't work

- Search, the map pins and the Android navigation bar do nothing.
- "Route" only re-centres the map. It doesn't give directions.
- There's no fuel-type filter (diesel users need this most), no "cheapest near me" sorting and no favourites.
- There are no price alerts or push notifications, including for the weekly DOE adjustment.
- **Rewards:** you can't redeem a voucher. There's no voucher detail, no code or QR, no "not enough points" state and no redemption history. All vouchers are identical placeholders.
- **Profile:** there's no profile, settings, logout, leaderboard or explanation of ranks. "Gold Contributor" appears without any definition.
- **Accounts:**
  - Sign Up collects no email address, yet password reset requires one.
  - There's no email verification and no Google sign-in.
  - There's no onboarding or location-permission screen.
- There's no admin or moderation tool for stations, prices, rewards or abusive users.
- There are no loading, empty, error or offline states.

### 2.3 Prototype defects

These were found by reading the prototype's interactions through the Figma API.

| Defect                                                                             | Cause                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Every "Update Price" says "Updating Cleanfuel".                                    | Every Update Price button, on every map screen, opens the same "Edit Price" overlay. |
| The points badge stays at 450 after "+50 points earned".                           | The prototype uses no variables.                                                     |
| Closing Points or Edit Price jumps to Home and loses the station you were viewing. | The X buttons use _Navigate to Home Page_ instead of _Close overlay_.                |
| The Login → loading transition visibly breaks apart.                               | A 1022 ms Smart Animate (Gentle spring) between frames whose layers don't match.     |
| Some taps go nowhere.                                                              | "Send Verification", "RESET PASSWORD" and one Sign Up layer link to no destination.  |
| The Seaoil card can't be reached.                                                  | The card is clipped in the carousel, and the list scrolls past the last card.        |
| The Forgot Password back arrow returns to Landing instead of Login.                | Wrong destination. A stray drag interaction also leads to Login.                     |
| The reset screen says "Forget Password" and uses a red main button.                | Copy error, and red is reserved for destructive actions.                             |
| The 0.8 s splash screen never shows.                                               | Flow 1 starts on the _second_ Landing Page frame.                                    |

### 2.4 Design system

- The file has 0 colour styles, 0 text styles and 0 variables.
- There's only 1 component set: the locate-me button.
- Five station screens are near-identical full-screen copies. In the app they become one data-driven screen.
- Text goes as small as 8 pt Light, which is too small to read comfortably on a phone.

### 2.5 Compliance

- The app collects location and email, so the Data Privacy Act of 2012 (RA 10173) requires a privacy notice and consent. The prototype has neither.
- There are no terms of use, no attribution for the map data, and no Filipino-language option.

## 3. What the app adds beyond the prototype

1. **Verified reporting:**
   - a GPS check against the station (within about 150 m),
   - an optional price-board photo,
   - confirm/dispute votes from other users,
   - outlier flags,
   - points that are pending until a report is verified.
2. **An append-only points ledger** with contributor tiers, a leaderboard and badges. The rules are configurable.
3. **Real voucher redemption** with a code or QR and a history. The capstone uses a mock partner catalogue.
4. **Station detail:** every fuel type, how fresh each price is, 30-day history and directions through Google Maps or Waze.
5. **Fuel-type filter, search and "cheapest near me."**
6. **Price alerts** and a **DOE weekly bulletin banner**.
7. **An admin console** in the web build for moderation.
8. **Offline cache, English and Filipino, dark mode, accessible text sizes, and privacy consent.**
9. **Stretch goal:** reading the price board photo on the device so the price form fills itself in.

## Sources

- [GMA News: list of pump price adjustments, 7 July 2026](https://www.gmanetwork.com/news/money/economy/993884/list-pump-price-adjustments-on-tuesday-july-7-2026/story/)
- [Top Gear Philippines: fuel price update, 7–13 July 2026](https://www.topgear.com.ph/news/industry-news/ph-fuel-price-update-july-7-13-2026-a2619-20260706)
- [Power Philippines: DOE announces sharp 21–27 July fuel price hike](https://powerphilippines.com/tag/gasoline-price-increase/)
- [Philstar: pump prices jump more than ₱4/L, September 2026](https://www.philstar.com/sports/2026/09/14/2556240/pump-prices-jump-more-p4-liter-week)
- [GMA News: fuel price hike, 25 August](https://www.gmanetwork.com/news/money/companies/999602/fuel-price-hike-set-on-tuesday-august-25/story/)
- [Manila Bulletin: crowdsourced gas price tracker for Metro Manila (March 2026)](https://mb.com.ph/2026/03/10/developer-launches-free-crowdsourced-gas-price-tracker-for-metro-manila)
- [NoypiGeeks: MetroFuelTracker](https://www.noypigeeks.com/?p=265614)
- [GAS-PH app listing](https://mwm.ai/apps/gas-ph/6747882475)
- [GAS-PH developer discussion (r/PinoyProgrammer)](https://redlib.hackliberty.org/r/PinoyProgrammer/comments/1l80byy/gasph_fuel_tracker/mx0yipt/?context=3)
- [BusinessWorld: DOE–Angkas pump-price reporting](https://www.bworldonline.com/?p=379645)
