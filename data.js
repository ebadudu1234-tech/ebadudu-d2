/* =========================================================
   D2 portfolio content — edit this file to change words, years, tags, order.
   (Same works as D1; this site keeps its own copy so the two never depend on each other.)
   Images/videos live in assets/work/<slug>/ and are listed in media.js
   (generated — the first item is the project's hero).

   slug     : folder name under assets/work/
   year     : WORK page order (newest first)
   tags     : pills on the work cards and project page
   cover    : which media item (0-based) to use on cards / slides
   hero     : which media item opens the project page (default 0)
   hoverVideo: which video plays when the cover is hovered (default: the first video)
   start    : seconds to skip at the head of the cover / hero video (title card)
   sequence : media items that take turns in one big frame under the intro, in order
   fit      : 'contain' shows the hero without cropping (for tall pages)
   intro    : paragraph beside the first image on the project page
   detail   : paragraph further down the project page
   ========================================================= */

const PROJECTS = [
  {
    slug: '550-cafe', title: '5:50 Cafe', year: 2026, tags: ['BRAND', 'SPACE'], cover: 0,
    intro: 'A brand identity for a café built around nuts and brown sugar. Each flavour — cashew, peanut, pistachio — becomes a flower-like pattern tile, and the tiles stack into a colourful system.',
    detail: 'The system carries through the storefront, interior, cups, menu screens, enamel pins, stickers and a gift box, so every touchpoint feels like part of the same sweet afternoon.',
  },
  {
    // sequence: hand sketch → line drawing → labelled render, taking turns under the intro
    slug: 'switchback', title: 'Switchback', year: 2026, tags: ['PRODUCT', 'BRAND', 'VIDEO'], cover: 8, sequence: [1, 2, 3],
    intro: 'Outdoor gear for dogs: a harness with a zip-on detachable hood, reflective piping and neon-lime hardware, plus a travel kit with a collapsible bowl.',
    detail: 'From hand sketches to rendered product views, labels, retail display and lifestyle scenes — designed for walks that go from city streets at night to beach runs.',
  },
  {
    slug: 'under-the-cyber-skin', title: 'Under the Cyber Skin', year: 2026, tags: ['EDITORIAL', 'SPACE'], cover: 0,
    intro: 'Modern Myths: Under the Cyber Skin — a magazine on how artists build new myths from bodies, technology and history, with interviews and artist sections.',
    detail: 'The editorial system extends into an exhibition proposal, with wayfinding graphics and posters placed in the gallery space.',
  },
  {
    slug: 'planting-pen', title: 'Planting Pen', year: 2026, tags: ['PRODUCT', 'PACKAGING'], cover: 0,
    intro: 'A planting kit shaped like a pen set: seed cartridges, pots and tools packed into a modular box that opens like a book.',
    detail: 'The process moves from structure sketches to clean three-view renders, then to the green-and-yellow Planting Pen packaging, seed refills and a Daily Sprout retail stand.',
  },
  {
    slug: 'sonar', title: 'Sónar', year: 2026, tags: ['EVENT', 'MOTION', 'VIDEO'], cover: 0,
    intro: 'Visual identity for an electronic music festival: a glowing radial symbol that lives on stage screens, projection mapping, posters and merch.',
    detail: 'Motion loops were made for both the main stage and vertical screens.',
  },
  {
    slug: 'toyukukoku', title: 'Toyukukoku', year: 2026, tags: ['EDITORIAL'], cover: 2, hero: 2, fit: 'contain',
    intro: 'Under the Mask — a magazine about the visual identity of Kamen Rider, and how the suit, mask and special effects shaped a hero through silhouette, motion and camera.',
    detail: 'Bold headlines, film stills and Japanese type are cut together like the tokusatsu shows they describe.',
  },
  {
    slug: 'lotus', title: 'Lotus Cigarette', year: 2026, tags: ['3D', 'MOTION', 'VIDEO'], cover: 0, start: 6.5,
    intro: '3D motion graphics for a fictional Lotus cigarette — paper, gold foil and lotus leaves drifting through water.',
    detail: '3D Motion Graphics, Summer 2026. Faculty: Maruyama.',
  },
  {
    slug: 'ocupus', title: 'Artificial Octopus', year: 2026, tags: ['3D', 'MOTION', 'VIDEO'], cover: 0, start: 5.6,
    intro: 'A 3D motion title sequence: an artificial octopus made of metal rings, glass tubes and soft pink tissue.',
    detail: '3D Motion Graphics, Summer 2026. Faculty: Maruyama.',
  },
  {
    slug: 'leviairab', title: 'Leviairab Bottle', year: 2026, tags: ['PACKAGING'], cover: 0,
    intro: 'Bottle and label design for a spirit, shown poolside in late-afternoon light.',
    detail: '',
  },
  {
    slug: 'after-dada', title: 'After Dada', year: 2025, tags: ['EDITORIAL'], cover: 0,
    intro: 'The Eye That Dreams — a zine that follows what happened after Dada, collaging surrealist images into new pages.',
    detail: 'Cut-outs, die-cut covers and loose layouts let the reader see one image hiding inside another.',
  },
  {
    slug: 'dada-newspaper', title: 'DADA Newspaper', year: 2025, tags: ['EDITORIAL'], cover: 0,
    intro: 'DADA! DADA! — a newspaper about the Dada movement. “No rules. No order. Only DADA.”',
    detail: 'Big condensed headlines crash into black-and-white figures across the spreads.',
  },
  {
    slug: 'game-zine', title: '2000s Game Zine', year: 2025, tags: ['EDITORIAL', 'GAME'], cover: 0,
    intro: 'A zine about the games of the 2000s — from Snake on a Nokia phone to pixel arcades — set in pixel type and game-screen colours.',
    detail: '',
  },
  {
    // cover + hero: the FLORA-final storefront clip (still frame on the card, plays on hover)
    slug: 'code-for-fun', title: 'Code For Fun', year: 2025, tags: ['BRAND', 'SPACE', 'UI', 'VIDEO'], cover: 0,
    intro: 'Where Play Meets Purpose — a brand for a kids’ coding education space, with zones like Pixel Lab, Maker Hub, Robo Lab and HTML Hero.',
    detail: 'The identity runs from the storefront, expo booth and pop-up to the website, a learning app, an AR glasses interface, subway and street posters, banners, stationery, totes and staff merch.',
  },
  {
    slug: 'allodox', title: 'Allodox', year: 2024, tags: ['GAME'], cover: 0,
    intro: 'An interactive pixel game that simulates life with decision-making paralysis, so players who don’t struggle with choices can step into the mindset of those who do.',
    detail: 'Based on everyday dilemmas and my internship in game design, I designed the levels, scenes and missions. The goal: help people see that making choices is not so hard.',
  },
  {
    slug: 'ungreen-shop', title: 'Ungreen Shop', year: 2024, tags: ['BRAND', 'PACKAGING', 'MOTION'], cover: 0,
    intro: 'Branding, motion graphics and packaging that rethink food additives. Most people fear “additives” because packaging is full of boring words and numbers.',
    detail: 'Ungreen Shop uses bubbly type, bright colours and simple graphics to explain additives in a fun, easy-to-understand way.',
  },
  {
    slug: 'yiwugo', title: 'Yiwugo', year: 2024, tags: ['BRAND', 'WAYFINDING', 'UI'], cover: 0,
    intro: 'A visual upgrade for the Yiwu Small Commodities Market — branding, a wayfinding system and front-end design.',
    detail: 'The bee, a social and hard-working creature, became the IP character that guides visitors through the market and its brochures.',
  },
  {
    slug: 'nuclear-tide', title: 'Nuclear Tide Evolutionaries', year: 2024, tags: ['INSTALLATION'], cover: 0,
    intro: 'An interactive device imagining how sea creatures might evolve in an ocean contaminated by nuclear wastewater.',
    detail: 'Not to make that future feel normal, but as a warning — a preventive exposure through visualisation.',
  },
];

/* Home page: full-screen slides, one per work (Figma direction 2 shows 6 dots).
   The first slide is also the card that grows to full screen at the end of the
   begin animation. Picks: the newest work with the most photos. */
const SLIDES = ['after-dada', 'switchback', 'code-for-fun', '550-cafe', 'sonar', 'under-the-cyber-skin'];

/* Begin animation: works fly in from outside and pile into a grey rectangle, which
   grows into the first slide. null = use every work (up to 16 cards); or list slugs. */
const INTRO_DECK = null;
