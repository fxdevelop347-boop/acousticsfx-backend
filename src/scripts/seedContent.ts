/**
 * Idempotent content seed: inserts default key-value entries only when the key does not exist.
 * Safe to run multiple times; does not overwrite existing CMS-edited values.
 * Run: npx tsx src/scripts/seedContent.ts  (or npm run seed:content)
 */
import { connectDb, disconnectDb } from '../config/db.js';
import { getContentCollection } from '../models/Content.js';
import type { ContentType } from '../types/index.js';

interface SeedEntry {
  key: string;
  value: string;
  type?: ContentType;
}

const DEFAULT_CONTENT: SeedEntry[] = [
  {
    key: 'home.hero.title',
    value:
      'We take pride in building stylish and featured acoustic solution.',
    type: 'text',
  },
  {
    key: 'home.hero.subtitle',
    value:
      'Our solutions are engineered for clarity, comfort, and visual harmony. Whether it\'s a studio, auditorium, or workspace, we bring together design precision and acoustic mastery to elevate every square foot.',
    type: 'text',
  },
  {
    key: 'home.hero.button1Label',
    value: 'Get Quote →',
    type: 'text',
  },
  {
    key: 'home.hero.button2Label',
    value: 'Connect With Us →',
    type: 'text',
  },
  {
    key: 'home.hero.backgroundImage',
    value: '/assets/home/background.png',
    type: 'image',
  },
  {
    key: 'about.hero.heading',
    value: 'Partner in Future Readiness',
    type: 'text',
  },
  {
    key: 'about.hero.subtitle',
    value:
      'Empowering tomorrow\'s spaces with acoustic solutions that blend precision, elegance, and performance.',
    type: 'text',
  },
  {
    key: 'about.hero.backgroundImage',
    value:
      "/assets/about/empty-flat-interrior-with-elements-decoration 1 (1).png",
    type: 'image',
  },
  {
    key: 'home.ourProduct.heading',
    value: 'Our Products',
    type: 'text',
  },
  {
    key: 'home.ourProduct.subheading',
    value: 'We Cut Through Noise to create architects that are thoughtful, timeless & Impactful.',
    type: 'text',
  },
  {
    key: 'home.ourProduct.body',
    value: 'Our inspired solutions have helped shape modern acoustic design. Alluring spaces, internationally recognised for their architectural elegance and exceptional sound management live here.',
    type: 'text',
  },
  {
    key: 'home.ourProduct.ctaLabel',
    value: 'VIEW ALL PRODUCTS →',
    type: 'text',
  },
  {
    key: 'home.caseStudies.heading',
    value: 'CASE STUDIES THAT \nINSPIRE US',
    type: 'text',
  },
  {
    key: 'home.caseStudies.subheading',
    value: 'A premium workspace faced disruptive noise and poor sound clarity. We designed and installed bespoke acoustic panels tailored to their architecture. The result: enhanced productivity, elegant aesthetics, and a healthier environment.',
    type: 'text',
  },
  {
    key: 'home.caseStudies.ctaLabel',
    value: 'VIEW ALL CASESTUDIES →',
    type: 'text',
  },
  {
    key: 'home.latestBlogs.heading',
    value: 'Our Latest Blogs',
    type: 'text',
  },
  {
    key: 'home.latestBlogs.subheading',
    value: 'A place to share knowledge about acoustic, noise & flooring solutions.',
    type: 'text',
  },
  {
    key: 'home.latestBlogs.ctaLabel',
    value: 'VIEW ALL BLOGS →',
    type: 'text',
  },
  {
    key: 'home.whyChooseUs.icon1',
    value: '/assets/home/quaone.svg',
    type: 'image',
  },
  {
    key: 'home.whyChooseUs.icon2',
    value: '/assets/home/quatwo.svg',
    type: 'image',
  },
  {
    key: 'home.whyChooseUs.icon3',
    value: '/assets/home/quathr.svg',
    type: 'image',
  },
  {
    key: 'home.whyChooseUs.icon4',
    value: '/assets/home/quafour.svg',
    type: 'image',
  },
  {
    key: 'home.whyChooseUs.icon5',
    value: '/assets/home/quafive.svg',
    type: 'image',
  },
  {
    key: 'home.whyChooseUs.icon6',
    value: '/assets/home/quasix.svg',
    type: 'image',
  },
  {
    key: 'home.testimonials.logo1',
    value: '/assets/about/vmware.svg.svg',
    type: 'image',
  },
  {
    key: 'home.testimonials.logo2',
    value: '/assets/about/Docusign-Testimonials-280-60-Baseline.svg.svg',
    type: 'image',
  },
  {
    key: 'home.testimonials.logo3',
    value: '/assets/about/frog.svg.svg',
    type: 'image',
  },
  {
    key: 'home.testimonials.logo4',
    value: '/assets/about/vmware.svg.svg',
    type: 'image',
  },
  {
    key: 'home.clients.title',
    value: 'Our Valuable Clients',
    type: 'text',
  },
  {
    key: 'home.clients.backgroundImage',
    value: '/assets/home/mask.jpg',
    type: 'image',
  },
  {
    key: 'footer.about',
    value: 'Its your premier destination for luxury and modern interior design',
    type: 'text',
  },
  {
    key: 'footer.copyright',
    value: '© Copyright 2025 FX Acoustic Solution — All Rights Reserved.',
    type: 'text',
  },
  {
    key: 'footer.contactEmail',
    value: 'email@gmail.com',
    type: 'text',
  },
  {
    key: 'footer.contactAddress1',
    value: 'Design Avenue Cityville, CA 90210 United States',
    type: 'text',
  },
  {
    key: 'footer.contactAddress2',
    value: 'Design Avenue Cityville, CA 90210 United States',
    type: 'text',
  },
  {
    key: 'contact.locations.title',
    value: 'A Space That Inspires',
    type: 'text',
  },
  {
    key: 'contact.locations.description',
    value: 'You wish to visit our place and sit with us on a coffee.',
    type: 'text',
  },
  {
    key: 'contact.trustedBy.title',
    value: 'Trusted By Industry Leaders',
    type: 'text',
  },
  {
    key: 'contact.trustedBy.description',
    value:
      'Join our roster of satisfied clients and experience the exceptional results and service that have earned us the trust of industry leaders worldwide.',
    type: 'text',
  },
  {
    key: 'contact.hero.heading',
    value: 'Have a Question or confusion:',
    type: 'text',
  },
  {
    key: 'contact.hero.subtitle',
    value: 'Contact Us',
    type: 'text',
  },
  {
    key: 'contact.hero.backgroundImage',
    value: '/assets/contacts/1d173913fbb7b4adf7587f36d280e8edcf59765a.png',
    type: 'image',
  },
  {
    key: 'home.hero.featureBoxes',
    value: JSON.stringify([
      {
        title: 'Acoustic Solution',
        description:
          'Ideal for auditoriums, studios, and performance spaces where sound precision is non-negotiable.',
        image: '/assets/home/fi_11062015.png',
        accentColor: 'yellow-400',
      },
      {
        title: 'Floor Solution',
        description:
          'Perfect for gyms, halls, and high-traffic zones — combining aesthetics with acoustic synergy.',
        image: '/assets/home/fi_7821525.png',
        accentColor: 'orange-400',
      },
      {
        title: 'Sound Proofing',
        description:
          'Custom solutions for homes, offices, and commercial spaces that demand quiet confidence.',
        image: '/assets/home/fi_17991697.png',
        accentColor: 'blue-400',
      },
    ]),
    type: 'text',
  },
  // Home about section
  { key: 'home.about.label', value: 'About Us', type: 'text' },
  { key: 'home.about.heading', value: 'Creative solutions by professional designers', type: 'text' },
  {
    key: 'home.about.body',
    value: 'At Acoustics FX, we transform ordinary spaces into extraordinary experiences. With over 15 years of expertise in acoustic solutions, premium wooden flooring, and advanced soundproofing, we blend science with design to deliver environments that inspire focus, comfort, and performance.',
    type: 'text',
  },
  { key: 'home.about.ctaLabel', value: 'Learn More', type: 'text' },
  { key: 'home.about.ctaLink', value: '/about', type: 'text' },
  { key: 'home.about.image', value: '/assets/home/rimage.png', type: 'image' },
  { key: 'home.about.backgroundImage', value: '/assets/home/bgimage.png', type: 'image' },
  // Home – Services Provided section
  { key: 'home.services.image', value: '/assets/home/image 1.png', type: 'image' },
  { key: 'home.services.subtitle', value: 'Services Provided by us', type: 'text' },
  {
    key: 'home.services.description',
    value:
      'From sports arenas to studios, our acoustic and flooring solutions transform spaces into high-functioning, visually striking environments.',
    type: 'text',
  },
  { key: 'home.services.ctaText', value: 'Learn More', type: 'text' },
  { key: 'home.services.ctaLink', value: '/about', type: 'text' },
  // About Page - Hero
  { key: 'about.hero.heading', value: 'Partner in Future Readiness', type: 'text' },
  { key: 'about.hero.subtitle', value: "Empowering tomorrow's spaces with acoustic solutions that blend precision, elegance, and performance.", type: 'text' },
  { key: 'about.hero.backgroundImage', value: '/assets/about/empty-flat-interrior-with-elements-decoration 1 (1).png', type: 'image' },
  { key: 'about.hero.cta1Label', value: 'Get Quote →', type: 'text' },
  { key: 'about.hero.cta1Link', value: '/contactus', type: 'text' },
  { key: 'about.hero.cta2Label', value: 'Connect With Us →', type: 'text' },
  { key: 'about.hero.cta2Link', value: '/contactus', type: 'text' },

  // About Page - Stats
  { key: 'about.stats.title', value: 'This is Our result', type: 'text' },
  { key: 'about.stats.subtitle', value: 'How capable we are at work shines through in every endeavor.', type: 'text' },
  { key: 'about.stats.stat1Value', value: '321+', type: 'text' },
  { key: 'about.stats.stat1Label', value: 'Acoustic Products', type: 'text' },
  { key: 'about.stats.stat2Value', value: '13K+', type: 'text' },
  { key: 'about.stats.stat2Label', value: 'Sq. Ft. Delivered', type: 'text' },
  { key: 'about.stats.stat3Value', value: '25+', type: 'text' },
  { key: 'about.stats.stat3Label', value: 'Industry Awards', type: 'text' },
  { key: 'about.stats.stat4Value', value: '15+', type: 'text' },
  { key: 'about.stats.stat4Label', value: 'Years Experience', type: 'text' },

  // About Page - Content (Story & Craft)
  { key: 'about.content.storyLabel', value: 'Our Story', type: 'text' },
  { key: 'about.content.storyHeading', value: 'The Power of Purity Source', type: 'text' },
  { key: 'about.content.storyBody1', value: 'Fx Acoustics Inc. is a premium manufacturer of high-performance solutions, blending cutting-edge sound control with elegant design. From NRC-certified panels to turnkey acoustic interiors, we specialize in transforming spaces across India and beyond.', type: 'text' },
  { key: 'about.content.storyBody2', value: 'Proudly Made in India and globally trusted, we have built our reputation on craftsmanship, reliability, and customer satisfaction.', type: 'text' },
  { key: 'about.content.storyImage1', value: '/assets/about/Image (1).png', type: 'image' },
  { key: 'about.content.storyImage2', value: '/assets/about/Image (2).png', type: 'image' },
  { key: 'about.content.craftLabel', value: 'Our Craft', type: 'text' },
  { key: 'about.content.craftHeading', value: 'Where Science Meets Design', type: 'text' },
  { key: 'about.content.craftBody1', value: 'Every panel we produce undergoes rigorous acoustic testing to meet international NRC standards. Our in-house design team collaborates with architects worldwide to create bespoke solutions that are as beautiful as they are functional.', type: 'text' },
  { key: 'about.content.craftBody2', value: 'From raw material selection to final installation, we maintain complete control over quality — ensuring every project delivers exceptional acoustic performance and lasting elegance.', type: 'text' },
  { key: 'about.content.craftImage1', value: '/assets/about/Image (3).png', type: 'image' },
  { key: 'about.content.craftImage2', value: '/assets/about/Image (4).png', type: 'image' },

  // About Page - Foundation
  { key: 'about.foundation.heading', value: 'Our Foundation of Trust & Innovation', type: 'text' },
  { key: 'about.foundation.subtitle', value: 'At FX Acoustics, our values bridge vision with purpose, shaping spaces that resonate beyond sound. Integrity, Innovation, Collaboration, and Customer-Centricity guide every solution we craft with care.', type: 'text' },
  { key: 'about.foundation.card1Title', value: 'Our Mission', type: 'text' },
  { key: 'about.foundation.card1Desc', value: 'Our mission at FX Acoustics is to blend functionality with aesthetics to create superior acoustic products that enhance the auditory and visual experience of any space. We are dedicated to delivering exceptional craftsmanship, personalized service, and sustainable solutions that exceed expectations.', type: 'text' },
  { key: 'about.foundation.image1', value: '/assets/about/Image (4).png', type: 'image' },
  { key: 'about.foundation.card2Title', value: 'Our Vision', type: 'text' },
  { key: 'about.foundation.card2Desc', value: 'At FX Acoustics, we envision becoming the foremost provider of innovative and decorative acoustic solutions — transforming spaces into environments that are both aesthetically striking and acoustically perfected.', type: 'text' },
  { key: 'about.foundation.image2', value: '/assets/about/bgfoundation.png', type: 'image' },
  { key: 'about.foundation.card3Title', value: 'Our Values', type: 'text' },
  { key: 'about.foundation.card3Desc', value: 'At FX Acoustics, our values bridge vision and purpose. Integrity builds trust, Innovation drives future-ready solutions, and Collaboration empowers us to co-create with architects and clients. We remain Customer-Centric, placing aspirations at the heart of every design decision.', type: 'text' },
  { key: 'about.foundation.image3', value: '/assets/about/6d475af8e833a39bf05332dcf051bd2d05e4d822.png', type: 'image' },

  // About Page - Values
  { key: 'about.values.label', value: 'Our Values', type: 'text' },
  { key: 'about.values.heading', value: 'We Build Values That Are Timeless, Thoughtful & Impactful.', type: 'text' },
  { key: 'about.values.val1Title', value: 'Integrity', type: 'text' },
  { key: 'about.values.val1Text', value: 'We uphold the highest standards of honesty and transparency, ensuring trust in every solution we deliver.', type: 'text' },
  { key: 'about.values.val2Title', value: 'Innovation', type: 'text' },
  { key: 'about.values.val2Text', value: 'We constantly push boundaries, blending advanced acoustics with design thinking to deliver future-ready solutions.', type: 'text' },
  { key: 'about.values.val3Title', value: 'Collaboration', type: 'text' },
  { key: 'about.values.val3Text', value: 'We work hand-in-hand with architects, designers, and clients, creating solutions that thrive on shared vision.', type: 'text' },
  { key: 'about.values.val4Title', value: 'Customer-centric', type: 'text' },
  { key: 'about.values.val4Text', value: 'We place our clients at the heart of every solution, designing experiences that reflect their needs and aspirations.', type: 'text' },
  { key: 'about.values.val5Title', value: 'Sustainability', type: 'text' },
  { key: 'about.values.val5Text', value: 'We design solutions that respect the environment, balancing performance with responsibility for a greener future.', type: 'text' },
  { key: 'about.values.val6Title', value: 'Excellence', type: 'text' },
  { key: 'about.values.val6Text', value: 'We strive for the highest standards in every detail, delivering acoustic solutions that set benchmarks in quality and design.', type: 'text' },

  // About Page - Innovation Video
  { key: 'about.innovation.title1', value: 'Our Story That Drives', type: 'text' },
  { key: 'about.innovation.title2', value: 'INNOVATION', type: 'text' },
  { key: 'about.innovation.body', value: 'From a bold vision to an industry-leading brand, FX Acoustics has pioneered acoustic solutions that blend craftsmanship with cutting-edge technology — transforming how spaces sound and feel.', type: 'text' },
  { key: 'about.innovation.image', value: '', type: 'image' },
  { key: 'about.innovation.video', value: '', type: 'video' },

  // About Page - Founder
  { key: 'about.founder.label', value: 'Meet our founder', type: 'text' },
  { key: 'about.founder.heading', value: 'Creating harmony between Innovation and Integrity shaping spaces that inspire trust.', type: 'text' },
  { key: 'about.founder.body1', value: 'At FX Acoustics, our journey began with a simple belief: sound has the power to shape how we live, work, and feel. Every panel, every design, and every solution we create is driven by a commitment to clarity, elegance, and impact.', type: 'text' },
  { key: 'about.founder.body2', value: "We don't just build acoustic products — we craft experiences. Experiences that empower architects, designers, and businesses to imagine spaces that are thoughtful, timeless, and future-ready. Our promise is rooted in integrity, innovation, and collaboration.", type: 'text' },
  { key: 'about.founder.body3', value: 'As we continue to grow, our vision remains unchanged: to cut through the noise and deliver solutions that inspire trust, elevate design, and leave a lasting impression.', type: 'text' },
  { key: 'about.founder.quoteName', value: '— Rahul, Founder & Creative Lead', type: 'text' },
  { key: 'about.founder.badgeNumber', value: '#1', type: 'text' },
  { key: 'about.founder.badgeTitle', value: 'Best Award 2023', type: 'text' },
  { key: 'about.founder.image', value: '/assets/about/Image (5).png', type: 'image' },
  // Home – Our Products section showcase images
  { key: 'home.ourProduct.product1Image', value: '/assets/home/homeone.png', type: 'image' },
  { key: 'home.ourProduct.product1Title', value: 'Slat', type: 'text' },
  { key: 'home.ourProduct.product2Image', value: '/assets/home/hometwo.png', type: 'image' },
  { key: 'home.ourProduct.product2Title', value: 'Wave Panel', type: 'text' },
  { key: 'home.ourProduct.product3Image', value: '/assets/home/homethree.png', type: 'image' },
  { key: 'home.ourProduct.product3Title', value: 'Groove Panel', type: 'text' },
  // Home – Creative Approach section images
  { key: 'home.creative.mainImage', value: '/assets/home/banImage.png', type: 'image' },
  { key: 'home.creative.secondaryImage', value: '/assets/home/banTwo.png', type: 'image' },
  // Home – Connect With Experts section image
  { key: 'home.connectExperts.image', value: '/assets/about/glassimg.jpg', type: 'image' },
  // Social media links
  { key: 'social.facebook', value: 'https://facebook.com/', type: 'text' },
  { key: 'social.instagram', value: 'https://instagram.com/', type: 'text' },
  { key: 'social.twitter', value: 'https://x.com/', type: 'text' },
  { key: 'social.linkedin', value: 'https://linkedin.com/', type: 'text' },
  { key: 'social.youtube', value: '', type: 'text' },
];

async function seed(): Promise<void> {
  await connectDb();

  const coll = getContentCollection();
  let inserted = 0;
  let skipped = 0;

  for (const entry of DEFAULT_CONTENT) {
    const existing = await coll.findOne({ key: entry.key });
    if (existing) {
      skipped++;
      continue;
    }
    await coll.insertOne({
      key: entry.key,
      value: entry.value,
      type: entry.type ?? 'text',
      updatedAt: new Date(),
    });
    inserted++;
  }

  console.log(
    `Content seed done. Inserted: ${inserted}, skipped (already present): ${skipped}`
  );
  await disconnectDb();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Content seed failed:', err);
  process.exit(1);
});
