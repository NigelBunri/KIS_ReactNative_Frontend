import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';

const fallbackCover = require('@/assets/logo-light.png');

type Props = {
  title: string;
  subtitle?: string;
  price?: string | number;
  salePrice?: string | number | null;
  compareAtPrice?: string | number | null;
  priceLabel?: string;
  coverUrl?: string | null;
  badgeText?: string;
  stockQty?: number;
  stockStatus?: string;
  rating?: number;
  reviewCount?: number;
  ctaLabel?: string;
  compact?: boolean;
  onPress?: () => void;
  onCTA?: () => void;
};

function StarRating({ rating, count }: { rating: number; count?: number }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const stars = Math.round(rating * 2) / 2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <KISIcon
          key={i}
          name={stars >= i ? 'star' : stars >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={responsive.isWatch ? 10 : 11}
          color={palette.gold}
        />
      ))}
      {count !== undefined && count > 0 && (
        <Text style={{ color: palette.subtext, fontSize: responsive.isWatch ? 9 : 10, fontWeight: '700' }}>
          ({count})
        </Text>
      )}
    </View>
  );
}

export default function MarketProductCard({
  title,
  subtitle,
  price,
  salePrice,
  compareAtPrice,
  priceLabel,
  coverUrl,
  badgeText,
  stockQty,
  stockStatus,
  rating,
  reviewCount,
  ctaLabel = 'View',
  compact = false,
  onPress,
  onCTA,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const tiny = responsive.isWatch || responsive.isCompactPhone;


  const displayPrice = salePrice ?? price;
  const originalPrice = salePrice != null ? (compareAtPrice ?? price) : null;
  const legacyPriceLabel = priceLabel;

  const discountPct = useMemo(() => {
    if (!salePrice || !originalPrice) return null;
    const sale = parseFloat(String(salePrice));
    const orig = parseFloat(String(originalPrice));
    if (!orig || orig <= sale) return null;
    return Math.round(((orig - sale) / orig) * 100);
  }, [salePrice, originalPrice]);

  const stockLabel = useMemo(() => {
    if (stockStatus === 'out_of_stock') return 'Out of stock';
    if (stockStatus === 'low_stock') return 'Low stock';
    if (stockQty != null && stockQty <= 5 && stockQty > 0) return `Only ${stockQty} left`;
    if (stockQty === 0) return 'Out of stock';
    return null;
  }, [stockQty, stockStatus]);

  const stockColor = stockLabel === 'Out of stock' ? (palette.danger) : (palette.gold);

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1.5,
        borderColor: palette.divider,
        backgroundColor: palette.surface,
        borderRadius: 18,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <View style={{ height: compact || tiny ? 110 : 140 }}>
        {coverUrl ? (
          <PermanentRemoteImage
            uri={coverUrl}
            domain="Market"
            stableKey={`market_title_${title}_${coverUrl}`}
            containerStyle={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Image source={fallbackCover} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        )}

        {discountPct !== null && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: palette.danger,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 11 }}>-{discountPct}%</Text>
          </View>
        )}

        {badgeText && !discountPct && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              borderWidth: 1.5,
              borderColor: palette.primary,
              backgroundColor: palette.primarySoft,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 11 }}>
              {badgeText}
            </Text>
          </View>
        )}

        {stockLabel && (
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: stockColor + 'ee',
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 10 }}>{stockLabel}</Text>
          </View>
        )}
      </View>

      <View style={{ padding: tiny ? 8 : 10, gap: 4 }}>
        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 13 }} numberOfLines={2}>
          {title}
        </Text>

        {subtitle && !compact && !tiny && (
          <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        {rating !== undefined && rating > 0 && (
          <StarRating rating={rating} count={reviewCount} />
        )}

        <View style={{ flexDirection: tiny ? 'column' : 'row', alignItems: tiny ? 'flex-start' : 'center', justifyContent: 'space-between', marginTop: 2, gap: tiny ? 7 : 0 }}>
          <View style={{ gap: 1 }}>
            {displayPrice !== undefined && displayPrice !== '' ? (
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: tiny ? 12 : 14 }}>
                USD {displayPrice}
              </Text>
            ) : legacyPriceLabel ? (
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: tiny ? 12 : 14 }}>
                {legacyPriceLabel}
              </Text>
            ) : null}
            {originalPrice !== undefined && originalPrice !== null && originalPrice !== '' && (
              <Text
                style={{
                  color: palette.subtext,
                  fontWeight: '600',
                  fontSize: 11,
                  textDecorationLine: 'line-through',
                }}
              >
                USD {originalPrice}
              </Text>
            )}
          </View>

          <Pressable
            onPress={onCTA}
            style={{
              borderWidth: 1.5,
              borderColor: palette.primary,
              backgroundColor: palette.primarySoft,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 12 }}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
