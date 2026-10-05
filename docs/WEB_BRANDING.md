# Web branding provenance

The v0.4 interface follows the current [official Ryo website](https://ryo-currency.com/),
inspected in its light and dark modes on 2026-10-05. Only the brand assets listed
below are included. Site templates, scripts and the legacy explorer UI are not
imported. All assets and fonts are served by this explorer's origin.

## Official assets

| Local asset | Official source | Use |
| --- | --- | --- |
| `web/public/brand/ryo-wordmark.svg` | The inline SVG in the official site's header | Unmodified Ryo wordmark |
| `web/src/app/icon.svg` | `ryo-logo-pack-vector/logo-circle-only-thick.svg` in the branding pack | Browser icon |
| `web/src/app/apple-icon.png` | `ryo-logo-pack-raster/favicon-pack/apple-touch-icon.png` in the branding pack | Apple touch icon |
| `web/public/brand/mountain-light.svg` | [Official day illustration](https://ryo-currency.com/gfx/d_mountain_fuji.svg) | Decorative header artwork |
| `web/public/brand/mountain-dark.svg` | [Official night illustration](https://ryo-currency.com/gfx/n_mountain_fuji.svg) | Decorative header artwork |

The [official Ryo gallery](https://ryo-currency.com/#branding) supplies the
[branding pack](https://ryo-currency.com/PR/ryo-logo-pack.zip) and permits use of
its images in materials about Ryo Currency. The assets remain Ryo branding;
they are not presented as project-authored artwork or relicensed under the
repository's code license. The SVGs retain their original paths and colors;
only the header illustration's display size and opacity are set by CSS.

SHA-256 of the bundled header assets:

```text
ryo-wordmark.svg  fa4ce31611ee10bb3aa74a18423fed1faed362239968e5cb1c602a0a13247bb8
mountain-light.svg  d292336c843b9a394d0ebb9debecc2cdea90a2230223759c9a2369b4c093548e
mountain-dark.svg  5db540f6797ee8fb58983a6fc4710b6564b7c4e52f95e4156cc7392e873761d5
```

## Palette and typography

The official site's day header uses cream `#f1d6a9` and forest `#113c38`;
its night header uses teal `#09191b` and sand `#ebcca5`. The official logo uses
blue `#3348a4` through `#5b9edb`. The explorer reuses these colors and adjusts
panel surfaces and secondary text for readable technical tables and contrast.

Inter Variable supplies body text; Montserrat Variable supplies navigation and
headings. Both families are used by the official website and bundled here through
Fontsource 5.3.0 under SIL OFL 1.1. The site's Neue Kaine hero typeface is not
redistributed. IBM Plex Mono remains the data/code typeface, also under OFL.
License notices are retained in `web/public/licenses/`.

## Review previews

The native dashboard screenshots in [validation](V0_4_VALIDATION.md) use a real
disposable genesis-only LMDB. They show empty timestamp/chart states rather than
invented chain activity. Populated browser-test screenshots use synthetic test
headers, including intentionally extreme uint64 values; they are test evidence,
not a live-network preview. Application code never imports those fixtures.
