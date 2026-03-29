import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { SectionType, SectionDataByType } from './types';
import BackgroundColorSelector from './BackgroundColorSelector';

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
};

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
}) => {
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

  return (
    <>
      <SectionHeading title="Contact Information" subtitle="How visitors can reach you" typography={typography} palette={palette} spacing={spacing} />
      <KISTextInput label="Section Title" value={String(data.title || '')} onChangeText={(v) => onChange(update(data, 'title', v))} />
      <KISTextInput label="Phone" value={String(data.phone || '')} onChangeText={(v) => onChange(update(data, 'phone', v))} style={{ marginTop: spacing.xs }} />
      <KISTextInput label="Email" value={String(data.email || '')} onChangeText={(v) => onChange(update(data, 'email', v))} style={{ marginTop: spacing.xs }} />
      <KISTextInput label="Address" multiline value={String(data.address || '')} onChangeText={(v) => onChange(update(data, 'address', v))} style={{ marginTop: spacing.xs }} />
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
}: Props) {
  const normalized = useMemo<Record<string, any>>(() => draftData || {}, [draftData]);
  const hasSectionBackgroundImage = !!String(normalized.sectionBackgroundImageUrl || '').trim();

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
      />
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
