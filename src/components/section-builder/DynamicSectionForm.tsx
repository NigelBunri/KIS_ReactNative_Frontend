import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KisContentTargetType, SectionType, SectionDataByType } from './types';
import BackgroundColorSelector from './BackgroundColorSelector';
import KisContentPickerModal from './KisContentPickerModal';
import KisVideoPickerModal, { type KisVideoResult } from './KisVideoPickerModal';

type Props = {
  selectedType: SectionType | null;
  draftData: Record<string, any>;
  onDataChange: (next: Record<string, any>) => void;
  onPickSingleImage: () => void;
  onPickSectionBackgroundImage: () => void;
  onRemoveSectionBackgroundImage: () => void;
  onPickGalleryImage: () => void;
  palette: any;
  typography: any;
  spacing: any;
  /** Only the "kis_content" section type needs these — WebsiteBuilderScreen,
   * this component's sole caller, always supplies both. */
  kisContentOwnerType?: string;
  kisContentOwnerId?: string;
  /** Owner-controlled per-section visibility, saved alongside `data` as a
   * sibling key on the section (see apps.websites.serializers'
   * validate_sections `responsive.hidden_on`), not inside `data` itself. */
  responsive?: { hidden_on?: Array<'mobile' | 'desktop'> };
  onResponsiveChange?: (next: { hidden_on?: Array<'mobile' | 'desktop'> }) => void;
};

const KIS_CONTENT_TARGET_TYPE_OPTIONS: Array<{ value: KisContentTargetType; label: string }> = [
  { value: 'course', label: 'Courses' },
  { value: 'product', label: 'Products' },
  { value: 'shop_service', label: 'Shop Services' },
  { value: 'health_service', label: 'Health Services' },
  { value: 'broadcast_channel', label: 'Channels' },
  { value: 'post', label: 'Posts' },
  { value: 'event', label: 'Events' },
  { value: 'testimonial', label: 'Testimonials' },
];

const SectionHeading = ({ title, subtitle, typography, palette, spacing }: any) => (
  <View style={{ marginBottom: spacing.sm }}>
    <Text style={{ ...typography.h3, color: palette.text }}>{title}</Text>
    {!!subtitle ? <Text style={{ ...typography.body, color: palette.subtext }}>{subtitle}</Text> : null}
  </View>
);

const update = (base: Record<string, any>, key: string, value: any) => ({ ...base, [key]: value });

const parseMultiline = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const toMultiline = (value: string[] | undefined) => (Array.isArray(value) ? value.join('\n') : '');

// Converts a regular share link into the embed-src format each provider's
// player actually needs (matches apps.websites.embeds' backend patterns) —
// most people paste a normal youtube.com/watch or youtu.be link, not the
// /embed/ form, so this saves that translation step rather than making
// every user do it by hand. Providers without a well-known share-link
// pattern (Calendly, Google Maps/Calendar, Spotify, Loom) are left as-is;
// those tools' own "Embed" share option already gives the right URL.
const normalizeEmbedUrl = (provider: string, raw: string): string => {
  const trimmed = raw.trim();
  if (provider === 'youtube') {
    const watch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  }
  if (provider === 'vimeo') {
    const watch = trimmed.match(/vimeo\.com\/(\d+)/);
    if (watch) return `https://player.vimeo.com/video/${watch[1]}`;
  }
  return trimmed;
};

const TypeSpecificFields = ({
  type,
  data,
  onChange,
  onPickSingleImage,
  onPickSectionBackgroundImage: _onPickSectionBackgroundImage,
  onPickGalleryImage,
  palette,
  typography,
  spacing,
  kisContentOwnerType,
  kisContentOwnerId,
}: {
  type: SectionType;
  data: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  onPickSingleImage: () => void;
  onPickSectionBackgroundImage: () => void;
  onPickGalleryImage: () => void;
  palette: any;
  typography: any;
  spacing: any;
  kisContentOwnerType?: string;
  kisContentOwnerId?: string;
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  if (type === 'hero_banner') {
    return (
      <>
        <SectionHeading title="Hero Banner" subtitle="Headline section with primary CTA" typography={typography} palette={palette} spacing={spacing} />
        <KISButton title="Select Background Image" variant="outline" onPress={onPickSingleImage} />
        <KISTextInput label="Background Image URL" value={String(data.backgroundImageUrl || '')} editable={false} style={{ marginTop: spacing.xs }} />
        <KISTextInput label="Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} style={{ marginTop: spacing.xs }} />
        <KISTextInput label="Subtitle" value={String(data.subtitle || '')} onChangeText={(v) => onChange(update(data, 'subtitle', v))} style={{ marginTop: spacing.xs }} />
        <KISTextInput label="CTA Button Text" value={String(data.ctaText || '')} onChangeText={(v) => onChange(update(data, 'ctaText', v))} style={{ marginTop: spacing.xs }} />
        <KISTextInput label="CTA Link" value={String(data.ctaLink || '')} onChangeText={(v) => onChange(update(data, 'ctaLink', v))} style={{ marginTop: spacing.xs }} />
      </>
    );
  }

  if (type === 'about') {
    return (
      <>
        <SectionHeading title="About Section" subtitle="Text + image narrative block" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput label="Rich Text Description" multiline value={String(data.description || '')} onChangeText={(v) => onChange(update(data, 'description', v))} style={{ marginTop: spacing.xs }} />
        <KISButton title="Select About Image" variant="outline" onPress={onPickSingleImage} />
        <KISTextInput label="Image URL" value={String(data.imageUrl || '')} editable={false} style={{ marginTop: spacing.xs }} />
        <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm }}>
          <KISButton
            title="Image Left"
            variant={data.layout === 'image_left' ? 'primary' : 'outline'}
            onPress={() => onChange(update(data, 'layout', 'image_left'))}
          />
          <KISButton
            title="Image Right"
            variant={data.layout === 'image_right' ? 'primary' : 'outline'}
            onPress={() => onChange(update(data, 'layout', 'image_right'))}
          />
        </View>
      </>
    );
  }

  if (type === 'image_gallery_grid') {
    const images = Array.isArray(data.images) ? data.images : [];
    return (
      <>
        <SectionHeading title="Image Gallery" subtitle="Add multiple images and choose a layout" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISButton title="Add Gallery Image" variant="outline" onPress={onPickGalleryImage} />
        <KISTextInput
          label="Image URLs (newline/comma separated)"
          multiline
          value={toMultiline(images)}
          onChangeText={(v) => onChange(update(data, 'images', parseMultiline(v)))}
          style={{ marginTop: spacing.xs }}
        />
        <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm }}>
          <KISButton
            title="2-Column"
            variant={data.gridStyle === 'two_column' ? 'primary' : 'outline'}
            onPress={() => onChange(update(data, 'gridStyle', 'two_column'))}
          />
          <KISButton
            title="Masonry"
            variant={data.gridStyle === 'masonry' ? 'primary' : 'outline'}
            onPress={() => onChange(update(data, 'gridStyle', 'masonry'))}
          />
        </View>
      </>
    );
  }

  if (type === 'statistics') {
    return (
      <>
        <SectionHeading title="Statistics" subtitle="Enter one metric per line in label::value format" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput
          label="Metrics"
          multiline
          value={Array.isArray(data.metrics) ? data.metrics.map((m: any) => `${m.label || ''}::${m.value || ''}`).join('\n') : ''}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'metrics',
                v
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => {
                    const [label, value] = line.split('::');
                    return { id: `metric_${idx}`, label: (label || '').trim(), value: (value || '').trim() };
                  }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  if (type === 'testimonials') {
    return (
      <>
        <SectionHeading title="Testimonials" subtitle="Use quote::author::role format" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput
          label="Testimonials"
          multiline
          value={Array.isArray(data.items) ? data.items.map((m: any) => `${m.quote || ''}::${m.author || ''}::${m.role || ''}`).join('\n') : ''}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'items',
                v
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => {
                    const [quote, author, role] = line.split('::');
                    return { id: `testimonial_${idx}`, quote: (quote || '').trim(), author: (author || '').trim(), role: (role || '').trim() };
                  }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  if (type === 'programs_services') {
    return (
      <>
        <SectionHeading title="Programs & Services" subtitle="Use card_name::description format" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput
          label="Cards"
          multiline
          value={Array.isArray(data.cards) ? data.cards.map((m: any) => `${m.name || ''}::${m.description || ''}`).join('\n') : ''}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'cards',
                v
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => {
                    const [name, description] = line.split('::');
                    return { id: `card_${idx}`, name: (name || '').trim(), description: (description || '').trim() };
                  }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  if (type === 'call_to_action') {
    return (
      <>
        <SectionHeading title="Call To Action" subtitle="Dedicated conversion section" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput label="Description" multiline value={String(data.description || '')} onChangeText={(v) => onChange(update(data, 'description', v))} style={{ marginTop: spacing.xs }} />
        <KISTextInput label="Button Text" value={String(data.buttonText || '')} onChangeText={(v) => onChange(update(data, 'buttonText', v))} style={{ marginTop: spacing.xs }} />
        <KISTextInput label="Button Link" value={String(data.buttonLink || '')} onChangeText={(v) => onChange(update(data, 'buttonLink', v))} style={{ marginTop: spacing.xs }} />
      </>
    );
  }

  if (type === 'contact_information') {
    return (
      <>
        <SectionHeading title="Contact Information" subtitle="How visitors can reach you" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput label="Phone" value={String(data.phone || '')} onChangeText={(v) => onChange(update(data, 'phone', v))} style={{ marginTop: spacing.xs }} />
        <KISTextInput label="Email" value={String(data.email || '')} onChangeText={(v) => onChange(update(data, 'email', v))} style={{ marginTop: spacing.xs }} />
        <KISTextInput label="Address" multiline value={String(data.address || '')} onChangeText={(v) => onChange(update(data, 'address', v))} style={{ marginTop: spacing.xs }} />
      </>
    );
  }

  if (type === 'faqs') {
    return (
      <>
        <SectionHeading title="FAQs" subtitle="Use question::answer format, one per line" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput
          label="Questions & Answers"
          multiline
          value={Array.isArray(data.items) ? data.items.map((m: any) => `${m.question || ''}::${m.answer || ''}`).join('\n') : ''}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'items',
                v.split('\n').map((line) => line.trim()).filter(Boolean).map((line, idx) => {
                  const [question, answer] = line.split('::');
                  return { id: `faq_${idx}`, question: (question || '').trim(), answer: (answer || '').trim() };
                }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  if (type === 'social_links') {
    return (
      <>
        <SectionHeading title="Social Links" subtitle="Use platform::url format, one per line" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput
          label="Links"
          multiline
          value={Array.isArray(data.links) ? data.links.map((m: any) => `${m.platform || ''}::${m.url || ''}`).join('\n') : ''}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'links',
                v.split('\n').map((line) => line.trim()).filter(Boolean).map((line, idx) => {
                  const [platform, url] = line.split('::');
                  return { id: `social_${idx}`, platform: (platform || '').trim(), url: (url || '').trim() };
                }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  if (type === 'hours') {
    return (
      <>
        <SectionHeading title="Hours" subtitle="Use day::hours format, one per line" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput
          label="Operating Hours"
          multiline
          value={Array.isArray(data.days) ? data.days.map((m: any) => `${m.day || ''}::${m.hours || ''}`).join('\n') : ''}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'days',
                v.split('\n').map((line) => line.trim()).filter(Boolean).map((line, idx) => {
                  const [day, hours] = line.split('::');
                  return { id: `hours_${idx}`, day: (day || '').trim(), hours: (hours || '').trim() };
                }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  if (type === 'form') {
    const fields = Array.isArray(data.fields) ? data.fields : [];
    return (
      <>
        <SectionHeading
          title="Contact Form"
          subtitle="Use label::type::required format, one field per line (type: text, email, or textarea; required: yes or no)"
          typography={typography}
          palette={palette}
          spacing={spacing}
        />
        <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <KISTextInput
          label="Submit Button Text"
          value={String(data.submitLabel || 'Submit')}
          onChangeText={(v) => onChange(update(data, 'submitLabel', v))}
          style={{ marginTop: spacing.xs }}
        />
        <KISTextInput
          label="Fields"
          multiline
          value={fields.map((f: any) => `${f.label || ''}::${f.type || 'text'}::${f.required ? 'yes' : 'no'}`).join('\n')}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'fields',
                v
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => {
                    const [label, rawType, rawRequired] = line.split('::');
                    const trimmedLabel = (label || '').trim() || `Field ${idx + 1}`;
                    const fieldType = ['text', 'email', 'textarea'].includes((rawType || '').trim())
                      ? (rawType || '').trim()
                      : 'text';
                    const slug = trimmedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || `field_${idx}`;
                    return {
                      id: `field_${idx}`,
                      key: `${slug}_${idx}`,
                      label: trimmedLabel,
                      type: fieldType,
                      required: (rawRequired || '').trim().toLowerCase() === 'yes',
                    };
                  }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  if (type === 'embed') {
    const providers: Array<{ value: string; label: string; hint: string }> = [
      { value: 'youtube', label: 'YouTube', hint: 'Paste any youtube.com or youtu.be video link' },
      { value: 'vimeo', label: 'Vimeo', hint: 'Paste any vimeo.com video link' },
      { value: 'calendly', label: 'Calendly', hint: 'Paste your Calendly booking page link' },
      { value: 'google_maps', label: 'Google Maps', hint: 'Paste a Google Maps "Embed a map" src URL' },
      { value: 'google_calendar', label: 'Google Calendar', hint: 'Paste a Google Calendar "Embed" src URL' },
      { value: 'spotify', label: 'Spotify', hint: 'Paste a Spotify "Embed" link (open.spotify.com/embed/...)' },
      { value: 'loom', label: 'Loom', hint: 'Paste a Loom "Embed" link (loom.com/embed/...)' },
    ];
    const activeProvider = providers.find((p) => p.value === data.provider) || providers[0];
    return (
      <>
        <SectionHeading title="Embed" subtitle="Add a video, booking widget, map, or player from a trusted provider" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title (optional)" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <Text style={{ ...typography.label, color: palette.text, marginTop: spacing.sm }}>Provider</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
          {providers.map((p) => (
            <KISButton
              key={p.value}
              title={p.label}
              size="sm"
              variant={data.provider === p.value ? 'primary' : 'outline'}
              onPress={() => onChange(update(data, 'provider', p.value))}
            />
          ))}
        </View>
        <KISTextInput
          label="Link"
          value={String(data.url || '')}
          onChangeText={(v) => onChange(update(data, 'url', normalizeEmbedUrl(String(data.provider || 'youtube'), v)))}
          style={{ marginTop: spacing.sm }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>{activeProvider.hint}</Text>
      </>
    );
  }

  if (type === 'kis_video') {
    const canPickVideo = !!kisContentOwnerType && !!kisContentOwnerId;
    const hasSelection = !!data.target_id;
    return (
      <>
        <SectionHeading title="KIS Video" subtitle="Embed one of your own KIS videos, played directly on your site" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput label="Section Title (optional)" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
        <View style={{ marginTop: spacing.sm }}>
          <KISButton
            title={hasSelection ? 'Change Video' : 'Choose Video'}
            variant="outline"
            disabled={!canPickVideo}
            onPress={() => setVideoPickerOpen(true)}
          />
          {!canPickVideo ? (
            <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
              Save this website first to browse your videos.
            </Text>
          ) : null}
          {hasSelection ? (
            <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
              Selected a video from {data.source === 'health_engine_item' ? 'your health services' : 'your channel'}.
            </Text>
          ) : null}
        </View>
        {canPickVideo ? (
          <KisVideoPickerModal
            visible={videoPickerOpen}
            ownerType={kisContentOwnerType as string}
            ownerId={kisContentOwnerId as string}
            selectedTargetId={data.target_id}
            onSelect={(video: KisVideoResult) => {
              // video_url/thumbnail_url are cosmetic — only for this
              // editor's own live preview. The public page always
              // re-resolves from source+target_id server-side
              // (apps.websites.kis_video.resolve_kis_video), same as
              // kis_content already does for its resolved_items.
              onChange({
                ...data,
                source: video.source,
                target_id: video.target_id,
                video_url: video.video_url,
                thumbnail_url: video.thumbnail_url,
              });
              setVideoPickerOpen(false);
            }}
            onClose={() => setVideoPickerOpen(false)}
          />
        ) : null}
      </>
    );
  }

  if (type === 'slideshow') {
    const slides = Array.isArray(data.slides) ? data.slides : [];
    return (
      <>
        <SectionHeading title="Slideshow" subtitle="Use imageUrl::headline::subheadline::ctaText::ctaLink format, one slide per line" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput
          label="Slides"
          multiline
          value={slides.map((s: any) => `${s.imageUrl || ''}::${s.headline || ''}::${s.subheadline || ''}::${s.ctaText || ''}::${s.ctaLink || ''}`).join('\n')}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'slides',
                v
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => {
                    const [imageUrl, headline, subheadline, ctaText, ctaLink] = line.split('::');
                    return {
                      id: `slide_${idx}`,
                      imageUrl: (imageUrl || '').trim(),
                      headline: (headline || '').trim(),
                      subheadline: (subheadline || '').trim(),
                      ctaText: (ctaText || '').trim(),
                      ctaLink: (ctaLink || '').trim(),
                    };
                  }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <KISButton
            title={data.autoplay === false ? 'Autoplay Off' : 'Autoplay On'}
            variant={data.autoplay === false ? 'outline' : 'primary'}
            size="sm"
            onPress={() => onChange(update(data, 'autoplay', data.autoplay === false))}
          />
        </View>
        <KISTextInput
          label="Seconds per slide"
          value={String(data.intervalSeconds ?? 5)}
          keyboardType="number-pad"
          onChangeText={(v) => onChange(update(data, 'intervalSeconds', Math.max(2, Math.min(30, Number(v) || 5))))}
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  if (type === 'promo_bar') {
    const messages = Array.isArray(data.messages) ? data.messages : [];
    return (
      <>
        <SectionHeading title="Promo Bar" subtitle="Use text::link format, one message per line (link is optional)" typography={typography} palette={palette} spacing={spacing} />
        <KISTextInput
          label="Messages"
          multiline
          value={messages.map((m: any) => (m.link ? `${m.text || ''}::${m.link}` : `${m.text || ''}`)).join('\n')}
          onChangeText={(v) =>
            onChange(
              update(
                data,
                'messages',
                v
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => {
                    const [text, link] = line.split('::');
                    return { id: `promo_${idx}`, text: (text || '').trim(), link: (link || '').trim() || undefined };
                  }),
              ),
            )
          }
          style={{ marginTop: spacing.xs }}
        />
        <KISTextInput
          label="Seconds per message"
          value={String(data.intervalSeconds ?? 4)}
          keyboardType="number-pad"
          onChangeText={(v) => onChange(update(data, 'intervalSeconds', Math.max(2, Math.min(30, Number(v) || 4))))}
          style={{ marginTop: spacing.xs }}
        />
      </>
    );
  }

  // kis_content — the live-linked section. Target type + explicit picks
  // (via KisContentPickerModal) or an auto filter; presentation config
  // controls how resolved items render on the public page.
  const canPick = !!kisContentOwnerType && !!kisContentOwnerId;
  const targetIds = Array.isArray(data.target_ids) ? data.target_ids : [];
  return (
    <>
      <SectionHeading title="Add KIS Content" subtitle="Show live courses, products, services, or other KIS content" typography={typography} palette={palette} spacing={spacing} />
      <KISTextInput label="Heading" value={String(data.heading || '')} onChangeText={(v) => onChange(update(data, 'heading', v))} />
      <Text style={{ ...typography.label, color: palette.text, marginTop: spacing.sm }}>Content Type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
        {KIS_CONTENT_TARGET_TYPE_OPTIONS.map((option) => (
          <KISButton
            key={option.value}
            title={option.label}
            size="sm"
            variant={data.target_type === option.value ? 'primary' : 'outline'}
            onPress={() => onChange(update(data, 'target_type', option.value))}
          />
        ))}
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <KISButton
          title={targetIds.length ? `Selected (${targetIds.length}) — Change` : 'Browse & Select'}
          variant="outline"
          disabled={!canPick}
          onPress={() => setPickerOpen(true)}
        />
        {!canPick ? (
          <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
            Save this website first to browse and select content.
          </Text>
        ) : null}
      </View>
      {canPick ? (
        <KisContentPickerModal
          visible={pickerOpen}
          targetType={data.target_type}
          ownerType={kisContentOwnerType as string}
          ownerId={kisContentOwnerId as string}
          selectedIds={targetIds}
          onToggle={(id) => {
            const next = targetIds.includes(id) ? targetIds.filter((existing: string) => existing !== id) : [...targetIds, id];
            onChange(update(data, 'target_ids', next));
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      <Text style={{ ...typography.label, color: palette.text, marginTop: spacing.sm }}>Display</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        {(['grid', 'carousel', 'list'] as const).map((mode) => (
          <KISButton
            key={mode}
            title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            size="sm"
            variant={data.presentation?.display_mode === mode ? 'primary' : 'outline'}
            onPress={() => onChange(update(data, 'presentation', { ...data.presentation, display_mode: mode }))}
          />
        ))}
      </View>
      <KISTextInput
        label="Max items to show"
        value={String(data.presentation?.limit ?? 6)}
        keyboardType="number-pad"
        onChangeText={(v) => onChange(update(data, 'presentation', { ...data.presentation, limit: Math.max(1, Math.min(50, Number(v) || 6)) }))}
        style={{ marginTop: spacing.xs }}
      />
      <Text style={{ ...typography.label, color: palette.text, marginTop: spacing.sm }}>Order</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        {([
          { value: 'recent', label: 'Newest First' },
          { value: 'alphabetical', label: 'A–Z' },
          { value: 'manual', label: 'My Selection Order' },
        ] as const).map((option) => (
          <KISButton
            key={option.value}
            title={option.label}
            size="sm"
            variant={(data.filter?.ordering || 'recent') === option.value ? 'primary' : 'outline'}
            onPress={() => onChange(update(data, 'filter', { ...data.filter, ordering: option.value }))}
          />
        ))}
      </View>
      {data.filter?.ordering === 'manual' && targetIds.length === 0 ? (
        <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
          "My Selection Order" needs specific items chosen above — otherwise it falls back to Newest First.
        </Text>
      ) : null}
      <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
        Visitors can load more beyond the limit above with a "Load more" button, if there's more to show.
      </Text>
      <KISTextInput label={'"View all" button label'} value={String(data.cta_label || '')} onChangeText={(v) => onChange(update(data, 'cta_label', v))} style={{ marginTop: spacing.xs }} />
    </>
  );
};

export default function DynamicSectionForm({
  selectedType,
  draftData,
  onDataChange,
  onPickSingleImage,
  onPickSectionBackgroundImage,
  onRemoveSectionBackgroundImage,
  onPickGalleryImage,
  palette,
  typography,
  spacing,
  kisContentOwnerType,
  kisContentOwnerId,
  responsive,
  onResponsiveChange,
}: Props) {
  const normalized = useMemo<Record<string, any>>(() => draftData || {}, [draftData]);
  const hasSectionBackgroundImage = !!String(normalized.sectionBackgroundImageUrl || '').trim();
  const hiddenOn = responsive?.hidden_on || [];
  const toggleHiddenOn = (breakpoint: 'mobile' | 'desktop') => {
    if (!onResponsiveChange) return;
    const next = hiddenOn.includes(breakpoint) ? hiddenOn.filter((bp) => bp !== breakpoint) : [...hiddenOn, breakpoint];
    onResponsiveChange({ hidden_on: next });
  };

  if (!selectedType) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: spacing.md,
          backgroundColor: palette.card,
          padding: spacing.md,
          marginTop: spacing.md,
        }}
      >
        <Text style={{ ...typography.body, color: palette.subtext }}>Select a section type to configure dynamic fields.</Text>
      </View>
    );
  }

  return (
    <View
      key={selectedType}
      style={{
        borderWidth: 1,
        borderColor: palette.divider,
        borderRadius: spacing.md,
        backgroundColor: palette.card,
        padding: spacing.md,
        marginTop: spacing.md,
      }}
    >
      <TypeSpecificFields
        type={selectedType}
        data={normalized}
        onChange={onDataChange}
        onPickSingleImage={onPickSingleImage}
        onPickSectionBackgroundImage={onPickSectionBackgroundImage}
        onPickGalleryImage={onPickGalleryImage}
        palette={palette}
        typography={typography}
        spacing={spacing}
        kisContentOwnerType={kisContentOwnerType}
        kisContentOwnerId={kisContentOwnerId}
      />
      <SectionHeading
        title="Responsive Visibility"
        subtitle="Hide this section on mobile or desktop visitors"
        typography={typography}
        palette={palette}
        spacing={spacing}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <KISButton
          title={hiddenOn.includes('mobile') ? 'Hidden on Mobile' : 'Visible on Mobile'}
          variant={hiddenOn.includes('mobile') ? 'outline' : 'primary'}
          onPress={() => toggleHiddenOn('mobile')}
        />
        <KISButton
          title={hiddenOn.includes('desktop') ? 'Hidden on Desktop' : 'Visible on Desktop'}
          variant={hiddenOn.includes('desktop') ? 'outline' : 'primary'}
          onPress={() => toggleHiddenOn('desktop')}
        />
      </View>
      <SectionHeading title="Selected Section Background" subtitle="Image or one of 6 color themes" typography={typography} palette={palette} spacing={spacing} />
      <KISButton title="Select Section Background Image" variant="outline" onPress={onPickSectionBackgroundImage} />
      <View style={{ marginTop: spacing.xs }}>
        <KISButton
          title="Remove Section Background Image"
          variant="outline"
          onPress={onRemoveSectionBackgroundImage}
          disabled={!hasSectionBackgroundImage}
        />
      </View>
      <KISTextInput
        label="Section Background Image URL"
        value={String(normalized.sectionBackgroundImageUrl || '')}
        editable={false}
        style={{ marginTop: spacing.xs }}
      />
      <BackgroundColorSelector
        value={String(normalized.sectionBackgroundColorKey || '')}
        onChange={(key) => onDataChange({ ...normalized, sectionBackgroundColorKey: key })}
        palette={palette}
        typography={typography}
        spacing={spacing}
        title="Section Background Color (6 options)"
        disabled={hasSectionBackgroundImage}
      />
      <TouchableOpacity
        onPress={() => onDataChange({} as SectionDataByType[SectionType])}
        style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
      >
        <Text style={{ ...typography.caption, color: palette.subtext }}>Reset Form For Selected Type</Text>
      </TouchableOpacity>
    </View>
  );
}
