# @greendays.day — feed post pipeline

Source for the Instagram posts of the app's own account. Sibling to
`_greengage-line/`, which is the publication's. The PNGs this produces are
output, not source: they live at `~/w/assets/green-days/ig-greendays/`.

## Run it

```
npm i @fontsource/nunito @fontsource/jetbrains-mono @fontsource/annie-use-your-telescope
```

```
python3 build-posts.py
```

Renders to `out/`. Needs Playwright with Chromium, which means the Claude cloud
container rather than the laptop, same as `_pt-calendar/postcards-render.mjs`.

## The three rules it enforces for you

**The grid cell is 4:5, not 1:1.** A 1080 square is centre-cropped to 864 wide
for the profile grid, losing 108px off each side. Centred layouts survive it;
left-aligned ones lose their first letter. The opening nine went up with "Tap
your basket" reading as "ap your basket" in the grid. The build now measures the
ink bounds of every rendered PNG and fails if anything sits inside that margin,
so it cannot happen quietly again. Design to `MARGIN`, which is 140.

A tile may still bleed a decorative plate off the right edge on purpose. Name
its slug in `BLEEDS_RIGHT` so the check only guards the side carrying meaning.

**Fonts come from npm, not from the network.** Google Fonts is blocked from the
render container and neither machine has Nunito or JetBrains Mono installed, so
the faces are inlined as woff2 data URIs. A data-URI face only loads when
something requests it, so every weight in use is explicitly loaded and then
checked before the screenshot. A turning-day card once shipped in a system
fallback and a critique read the fallback as a deliberate choice.

**Nunito has no Greek subset. JetBrains Mono does.** Every Greek string has to
live in a mono run. `guard()` marks the Nunito-set strings and the build fails
if Greek lands in one, and the render separately checks Greek coverage by text
rather than by family name.

## Two things the build cannot check

**Dated posts.** Anything saying "today" is only true on its day, and anything
listing what is in season has to be recomputed the morning it goes out. The
opening set had two posts pinned to 15 September and a third whose Lisboa list
changed on the 16th.

**Shared plates.** Several ids draw an archetype rather than their own
illustration: `watermelon` and `honeydew-melon` both draw `melon`, `quince`
draws `pear`, `peach` and `nectarine` draw `stone-fruit`, `kale` and
`cavolo-nero` both draw `chard`. Fine for a seasonality post, wrong for a post
whose subject is naming precision. Check `illustration` in `produce.json`
before building a name post around an item.

## Captions

Buying lines come from the item's own `selection` field in `produce.json`,
unedited, so the caption and the app say the same words about the same fruit.

No etymology. The obvious aubergine caption is that the south kept an older word
while the north took the French one, and it is wrong: `aubergine`, `berenjena`,
`melanzana` and `μελιτζάνα` all descend from the same Arabic root by different
routes. Describe the list rather than explaining it, which is also the only
version that needs no source.
